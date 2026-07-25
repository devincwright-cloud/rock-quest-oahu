#!/usr/bin/env python3
"""
Rock Quest Oahu local server
- Serves the PWA
- POST /api/identify → real xAI vision (requires XAI_API_KEY)
- Loads key from environment or rock-quest/.env
"""
from __future__ import annotations

import json
import os
import re
import sys
import traceback
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("PORT", "8787"))

# Raise default for large base64 images
try:
    import http.server as _hs

    _hs.SimpleHTTPRequestHandler.protocol_version = "HTTP/1.1"
except Exception:
    pass


def load_dotenv(path: Path) -> None:
    """Minimal .env loader (KEY=VALUE). Does not override existing env."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip("'").strip('"')
        if key and key not in os.environ:
            os.environ[key] = val


load_dotenv(ROOT / ".env")

XAI_API_KEY = os.environ.get("XAI_API_KEY", "").strip()
XAI_BASE = os.environ.get("XAI_BASE_URL", "https://api.x.ai/v1").rstrip("/")
# Prefer vision-capable models; allow override
MODEL = os.environ.get("XAI_VISION_MODEL", "grok-4.5").strip()
FALLBACK_MODELS = [
    m
    for m in [
        MODEL,
        "grok-4.5",
        "grok-2-vision-latest",
        "grok-2-vision-1212",
    ]
    if m
]
# unique preserve order
_seen = set()
FALLBACK_MODELS = [m for m in FALLBACK_MODELS if not (m in _seen or _seen.add(m))]

SYSTEM_PROMPT = """You are Rock Quest Oahu's expert geology field-guide for kids (ages 7–14) and parents.
Identify rocks and minerals from a PHOTO accurately.

SCOPE (CRITICAL):
- Identify specimens from ANYWHERE in the world.
- Default: NO regional bias. Only if the user message includes "OUTDOOR FIND CONTEXT" may you use geography as a SOFT prior.
- Even with outdoor context, visual evidence ALWAYS overrides location (never force basalt/scoria over clear pyrite/quartz/etc.).
- Do NOT default to basalt or scoria. Those are only correct when the photo actually looks like volcanic lava rock.
- Kids often photograph: field finds, polished/tumbled stones, and rock-shop specimens. Identify those correctly too.

OUTPUT FORMAT (MANDATORY):
- Reply with EXACTLY ONE JSON object. Nothing else.
- No markdown fences (no ```). No text before or after the JSON. No second object.
- Start with { and end with }.

VISUAL MATCHING (CRITICAL):
1. Base the ID ONLY on what is visible: color, luster (metallic vs glassy vs dull), crystal shape, texture, polish, banding, transparency.
2. Match THIS specimen — not a fixed “common local rocks” list.
3. Common lookalikes kids photograph (recognize these when they fit):
   - Pyrite: brassy/metallic gold, often cubic or glittery metallic (NOT yellow paint dirt)
   - Quartz: clear, white, milky, rose (pink), smoky (brown-gray), often glassy/crystal
   - Amethyst: purple quartz
   - Citrine: yellow/orange quartz (often polished)
   - Other rock-shop favorites: jasper, agate, tiger’s eye, howlite, sodalite, turquoise-looking stones, fluorite, calcite, hematite, magnetite, mica, feldspar, granite, sandstone, limestone, obsidian, etc.
4. If polished/tumbled/store-bought: still identify the mineral/rock (e.g. tumbled rose quartz, polished agate) — do NOT reclassify as basalt/scoria.
5. Top 2–3 candidates that fit THIS photo; confidences 0–1, best first. Prefer specific names (e.g. “Rose quartz” not just “rock”).
6. rarity: common | uncommon | rare | ultra
   - common: quartz, granite, sandstone, limestone, many field pebbles
   - uncommon: pyrite, hematite, mica books, pumice, nice crystals
   - rare: fine amethyst/agate specimens, etc.
   - ultra: diamond, ruby, sapphire-class exceptional gems only
7. NEVER hype money. Kid-friendly short sentences.
8. fieldTests: 2–3 SPECIFIC yes/no questions for THAT identification vs lookalikes (expectsYes true/false, weight 0.05–0.12).
9. If unidentifiable or not a rock, say so with low confidence.

JSON SCHEMA (single object):
{
  "summary": "one friendly sentence about what you see",
  "candidates": [
    {
      "name": "Pyrite",
      "rockId": "pyrite",
      "confidence": 0.72,
      "rarity": "uncommon",
      "properties": {
        "hardness": "6–6.5",
        "luster": "metallic",
        "appearance": "brassy gold, often cubic"
      },
      "facts": ["Also called fool's gold.", "Harder than real gold.", "Often forms cubes."],
      "fieldTests": [
        {"id": "metallic", "question": "Does it look metallic brassy gold?", "expectsYes": true, "weight": 0.1},
        {"id": "soft_gold", "question": "Can a fingernail dent it like soft gold?", "expectsYes": false, "weight": 0.09}
      ],
      "valueNote": "Cool for learning — not treasure-map money!"
    }
  ],
  "safetyNote": "Stay safe, public land only, go with a grown-up."
}
"""


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # Avoid stale JS during development
        if self.path.endswith((".js", ".css", ".html")) or self.path in ("/", "/index.html"):
            self.send_header("Cache-Control", "no-store, max-age=0")
        else:
            self.send_header("Cache-Control", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/status":
            key = current_key()
            return self.json_response(
                200,
                {
                    "vision": bool(key),
                    "demo": not bool(key),
                    "needsKey": not bool(key),
                    "model": MODEL if key else None,
                    "modelsTried": FALLBACK_MODELS if key else [],
                    "message": (
                        f"Live vision ready ({MODEL})"
                        if key
                        else "Add XAI_API_KEY to rock-quest/.env then restart the server"
                    ),
                    "setupHint": "Create rock-quest/.env with: XAI_API_KEY=xai-...  (from https://console.x.ai)",
                },
            )
        return super().do_GET()

    def do_POST(self):
        path = self.path.split("?")[0]
        if path == "/api/identify":
            return self.handle_identify()
        if path == "/api/set-key":
            return self.handle_set_key()
        self.send_error(404, "Not found")

    def handle_set_key(self):
        """Local-only helper: save XAI_API_KEY into .env and hot-reload."""
        body = self.read_json()
        if body is None:
            return
        key = (body.get("key") or body.get("XAI_API_KEY") or "").strip()
        if not key or len(key) < 10:
            return self.json_response(400, {"error": "Paste a valid XAI_API_KEY from console.x.ai"})
        env_path = ROOT / ".env"
        lines = []
        if env_path.is_file():
            for line in env_path.read_text(encoding="utf-8").splitlines():
                if line.strip().startswith("XAI_API_KEY="):
                    continue
                lines.append(line)
        lines.append(f"XAI_API_KEY={key}")
        env_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
        os.environ["XAI_API_KEY"] = key
        global XAI_API_KEY
        XAI_API_KEY = key
        print("XAI_API_KEY saved to .env and loaded.", file=sys.stderr)
        return self.json_response(200, {"ok": True, "vision": True, "message": "API key saved. Try Identify again!"})

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self.json_response(400, {"error": "Invalid JSON body"})
            return None

    def handle_identify(self):
        body = self.read_json()
        if body is None:
            return

        image = body.get("image") or ""
        if not isinstance(image, str) or not image.startswith("data:image"):
            return self.json_response(400, {"error": "Expected image as a data:image/...;base64,... URL"})

        # Cap huge payloads (~8MB base64 ~)
        if len(image) > 12_000_000:
            return self.json_response(400, {"error": "Image too large — try a smaller photo"})

        key = current_key()
        if not key:
            return self.json_response(
                503,
                {
                    "error": "Vision API key not configured",
                    "needsKey": True,
                    "demo": False,
                    "setupHint": "Add XAI_API_KEY to rock-quest/.env (see console.x.ai) or use the setup form in the app, then restart if needed.",
                },
            )

        # Location is optional soft prior only when client says foundOutside=true.
        found_outside = bool(body.get("foundOutside"))
        location = body.get("location") if found_outside else None

        geo_note = ""
        if (
            found_outside
            and isinstance(location, dict)
            and location.get("lat") is not None
            and location.get("lng") is not None
        ):
            lat = location.get("lat")
            lng = location.get("lng")
            place = (location.get("placeName") or location.get("label") or "").strip()
            place_bit = f" near {place}" if place else ""
            geo_note = (
                f"\n\nOUTDOOR FIND CONTEXT (soft prior only): The kid says this was found outside{place_bit} "
                f"(approx GPS {lat}, {lng}). "
                "You MAY gently prefer rocks that are plausible for that geography/geology "
                "(e.g. volcanic basalt/scoria more common in Hawaii; beach pebbles on coasts; "
                "granite/sedimentary in many continental areas). "
                "CRITICAL: Visual evidence ALWAYS wins. If the photo clearly shows pyrite, quartz, "
                "amethyst, polished store specimens, etc., identify those — do NOT force local volcanic rocks. "
                "Do not invent a local ID that contradicts color, luster, or crystal form."
            )

        user_text = (
            "Identify the rock or mineral in this photograph. "
            "Primary evidence is ALWAYS what you see: color, luster (metallic vs glassy), crystal shape, "
            "polish/tumble, texture, and transparency. "
            "Identify specimens from anywhere in the world. "
            "If it looks like pyrite, quartz (clear/rose/smoky), amethyst, citrine, agate, jasper, "
            "or other rock-shop/polished stones, name those correctly. "
            "Do not default to basalt or scoria unless the photo clearly shows volcanic lava rock."
            + geo_note
            + "\nReply with EXACTLY ONE JSON object matching the schema — no markdown, no extra commentary, no second object."
        )

        if not found_outside:
            user_text = (
                "Identify the rock or mineral in this photograph using VISUAL EVIDENCE ONLY. "
                "Do NOT apply any regional or location bias. Do not assume Hawaii, beach, or volcano. "
                "Look carefully at color, luster (metallic vs glassy), crystal shape, polish/tumble, texture, and transparency. "
                "If it looks like pyrite, quartz, amethyst, citrine, agate, jasper, or another rock-shop/specimen stone, name that. "
                "Do not default to basalt or scoria unless the photo clearly shows volcanic lava rock. "
                "Reply with EXACTLY ONE JSON object matching the schema — no markdown, no extra commentary, no second object."
            )

        raw_text = ""
        model_used = ""
        try:
            text, model_used = call_vision(key, image, user_text)
            raw_text = text or ""
            result = extract_json(raw_text)
            # light validation
            if not isinstance(result, dict) or not result.get("candidates"):
                raise ValueError("Model JSON missing candidates")
            # ensure 2–3 candidates
            cands = result["candidates"]
            if not isinstance(cands, list) or len(cands) < 1:
                raise ValueError("No candidates in model response")
            result["candidates"] = cands[:3]
            print(
                f"Identify OK via {model_used}: {[c.get('name') for c in result['candidates']]}",
                file=sys.stderr,
            )
            return self.json_response(
                200,
                {
                    "result": result,
                    "demo": False,
                    "needsKey": False,
                    "model": model_used,
                },
            )
        except Exception as e:
            traceback.print_exc()
            log_path = log_raw_response(raw_text, model_used, str(e))
            print(f"Identify FAILED. Raw response logged to: {log_path}", file=sys.stderr)
            preview = (raw_text or "")[:500].replace("\n", "\\n")
            print(f"Raw preview (500 chars): {preview}", file=sys.stderr)
            return self.json_response(
                502,
                {
                    "error": f"Vision API failed: {e}",
                    "needsKey": False,
                    "demo": False,
                    "hint": "Check XAI_API_KEY, model name, and API credits at console.x.ai",
                    "rawPreview": (raw_text or "")[:800],
                    "logFile": str(log_path) if log_path else None,
                },
            )

    def json_response(self, code: int, obj: dict):
        data = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def current_key() -> str:
    return (os.environ.get("XAI_API_KEY") or XAI_API_KEY or "").strip()


def http_json(url: str, payload: dict, key: str, timeout: int = 180) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "User-Agent": "RockQuest/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")[:2000]
        raise RuntimeError(f"HTTP {e.code}: {err_body}") from e


def call_vision(key: str, image_data_url: str, user_text: str) -> tuple[str, str]:
    """Try Responses API then Chat Completions across model list."""
    errors = []
    for model in FALLBACK_MODELS:
        # 1) Responses API (docs.x.ai image understanding)
        try:
            payload = {
                "model": model,
                "temperature": 0.1,
                "instructions": SYSTEM_PROMPT
                + "\n\nIMPORTANT: Output exactly one JSON object. No markdown. No prose outside JSON.",
                "input": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "input_image", "image_url": image_data_url, "detail": "high"},
                            {"type": "input_text", "text": user_text},
                        ],
                    }
                ],
            }
            data = http_json(f"{XAI_BASE}/responses", payload, key)
            text = extract_output_text(data)
            if text and text.strip():
                return text, f"responses:{model}"
            errors.append(f"responses:{model}: empty text")
        except Exception as e:
            errors.append(f"responses:{model}: {e}")

        # 2) Chat Completions vision format
        try:
            payload = {
                "model": model,
                "temperature": 0.1,
                "messages": [
                    {
                        "role": "system",
                        "content": SYSTEM_PROMPT
                        + "\n\nIMPORTANT: Output exactly one JSON object. No markdown. No prose outside JSON.",
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": image_data_url, "detail": "high"},
                            },
                            {"type": "text", "text": user_text},
                        ],
                    },
                ],
            }
            data = http_json(f"{XAI_BASE}/chat/completions", payload, key)
            text = (
                ((data.get("choices") or [{}])[0].get("message") or {}).get("content")
                or ""
            )
            if isinstance(text, list):
                # some APIs return content parts
                text = "\n".join(
                    p.get("text", "") if isinstance(p, dict) else str(p) for p in text
                )
            if text and str(text).strip():
                return str(text), f"chat:{model}"
            errors.append(f"chat:{model}: empty text")
        except Exception as e:
            errors.append(f"chat:{model}: {e}")

    raise RuntimeError("All vision attempts failed → " + " | ".join(errors[:6]))


def extract_output_text(data: dict) -> str:
    if isinstance(data.get("output_text"), str) and data["output_text"].strip():
        return data["output_text"]
    chunks = []
    for item in data.get("output") or []:
        if not isinstance(item, dict):
            continue
        # message type
        if item.get("type") == "message" or item.get("role") == "assistant":
            for c in item.get("content") or []:
                if isinstance(c, dict):
                    if c.get("type") in ("output_text", "text"):
                        chunks.append(c.get("text") or "")
                    elif "text" in c:
                        chunks.append(str(c.get("text") or ""))
                elif isinstance(c, str):
                    chunks.append(c)
        for c in item.get("content") or []:
            if isinstance(c, dict) and c.get("type") in ("output_text", "text"):
                chunks.append(c.get("text") or "")
    if chunks:
        return "\n".join(chunks)
    choices = data.get("choices") or []
    if choices:
        msg = choices[0].get("message") or {}
        content = msg.get("content")
        if isinstance(content, str):
            return content
    return ""


def log_raw_response(raw_text: str, model_used: str, error: str) -> Path | None:
    """Write raw model text to logs/ for debugging parse failures."""
    try:
        log_dir = ROOT / "logs"
        log_dir.mkdir(exist_ok=True)
        ts = __import__("datetime").datetime.now().strftime("%Y%m%d-%H%M%S")
        path = log_dir / f"identify-fail-{ts}.txt"
        path.write_text(
            f"model={model_used}\nerror={error}\n--- RAW RESPONSE ---\n{raw_text or '(empty)'}\n",
            encoding="utf-8",
        )
        return path
    except Exception as e:
        print(f"Could not write raw log: {e}", file=sys.stderr)
        return None


def extract_json(text: str) -> dict:
    """
    Robustly extract the first JSON object from model output.
    Handles: pure JSON, markdown fences, leading/trailing prose, trailing extra JSON ("Extra data").
    """
    if not text or not str(text).strip():
        raise ValueError("Empty model response")

    original = str(text)
    s = original.strip()

    # Strip common markdown fences (first fenced block preferred)
    fence = re.search(r"```(?:json|JSON)?\s*([\s\S]*?)```", s)
    if fence:
        s = fence.group(1).strip()

    # Normalize smart quotes that sometimes break JSON
    s = (
        s.replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2018", "'")
        .replace("\u2019", "'")
    )

    decoder = json.JSONDecoder()

    def try_raw_decode(blob: str, start: int = 0) -> dict:
        obj, end = decoder.raw_decode(blob, start)
        if not isinstance(obj, dict):
            raise ValueError(f"JSON root must be object, got {type(obj).__name__}")
        # Ignore trailing junk after first object (fixes "Extra data: line N")
        trailing = blob[end:].strip()
        if trailing:
            print(
                f"extract_json: ignored {len(trailing)} trailing chars after JSON object",
                file=sys.stderr,
            )
        return obj

    # 1) Whole string (or after fence)
    try:
        return try_raw_decode(s, 0)
    except json.JSONDecodeError:
        pass

    # 2) Find each "{" and try raw_decode from there
    for i, ch in enumerate(s):
        if ch != "{":
            continue
        try:
            return try_raw_decode(s, i)
        except json.JSONDecodeError:
            continue

    # 3) Last-resort: slice first "{" through last "}" (may still fail on nested extras)
    start = s.find("{")
    end = s.rfind("}")
    if start >= 0 and end > start:
        chunk = s[start : end + 1]
        try:
            return try_raw_decode(chunk, 0)
        except json.JSONDecodeError:
            # 4) Balanced-brace scan for first complete object
            depth = 0
            in_str = False
            esc = False
            for j in range(start, len(s)):
                c = s[j]
                if in_str:
                    if esc:
                        esc = False
                    elif c == "\\":
                        esc = True
                    elif c == '"':
                        in_str = False
                    continue
                if c == '"':
                    in_str = True
                elif c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0:
                        try:
                            return try_raw_decode(s[start : j + 1], 0)
                        except json.JSONDecodeError as e:
                            raise ValueError(f"Could not parse JSON object: {e}") from e

    raise ValueError("Model did not return a parseable JSON object. Preview: " + original[:400])


def main():
    os.chdir(ROOT)
    # re-read after chdir
    load_dotenv(ROOT / ".env")
    global XAI_API_KEY
    XAI_API_KEY = os.environ.get("XAI_API_KEY", "").strip()

    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    mode = "LIVE vision (XAI_API_KEY set)" if current_key() else "NO KEY — set rock-quest/.env XAI_API_KEY=..."
    print(f"Rock Quest Oahu → http://0.0.0.0:{PORT}")
    print(f"  Local:  http://localhost:{PORT}")
    print(f"  Mode:   {mode}")
    print(f"  Model:  {MODEL}")
    print(f"  .env:   {ROOT / '.env'}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nBye!")


if __name__ == "__main__":
    main()
