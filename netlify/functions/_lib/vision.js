/**
 * Shared xAI vision helpers for Netlify functions.
 * Optimized for short serverless timeouts (try 1–2 fast paths only).
 */

const SYSTEM_PROMPT = `You are Rock Quest Oahu's expert geology field-guide for kids (ages 7–14) and parents.
Identify rocks and minerals from a PHOTO accurately.

SCOPE (CRITICAL):
- Identify specimens from ANYWHERE in the world.
- Default: NO regional bias. Only if the user message includes "OUTDOOR FIND CONTEXT" may you use geography as a SOFT prior.
- Even with outdoor context, visual evidence ALWAYS overrides location.
- Do NOT default to basalt or scoria unless the photo clearly shows volcanic lava rock.

OUTPUT FORMAT (MANDATORY):
- Reply with EXACTLY ONE JSON object. Nothing else.
- No markdown fences. No text before or after the JSON.
- Start with { and end with }.

VISUAL MATCHING:
1. Base the ID ONLY on visible color, luster, crystal shape, texture, polish, banding, transparency.
2. Kids often photograph field finds, tumbled stones, and rock-shop specimens — identify those correctly.
3. Top 2–3 candidates; confidences 0–1; rarity: common | uncommon | rare | ultra.
4. fieldTests: 2–3 specific yes/no questions (expectsYes, weight 0.05–0.12).
5. NEVER hype money. Kid-friendly short sentences.

JSON SCHEMA:
{
  "summary": "one friendly sentence",
  "candidates": [
    {
      "name": "Pyrite",
      "rockId": "pyrite",
      "confidence": 0.72,
      "rarity": "uncommon",
      "properties": { "hardness": "6–6.5", "luster": "metallic", "appearance": "brassy gold" },
      "facts": ["Also called fool's gold."],
      "fieldTests": [
        {"id": "metallic", "question": "Does it look metallic brassy gold?", "expectsYes": true, "weight": 0.1}
      ],
      "valueNote": "Cool for learning — not treasure-map money!"
    }
  ],
  "safetyNote": "Stay safe, public land only, go with a grown-up."
}
`;

function getPrimaryModel() {
  // Prefer a current vision-capable model. Override with XAI_VISION_MODEL in Netlify env.
  return (process.env.XAI_VISION_MODEL || "grok-4.5").trim();
}

function getModelList() {
  // Keep list short — Netlify free functions often have ~10s limit
  const primary = getPrimaryModel();
  const list = [primary, "grok-4.5", "grok-2-vision-latest"];
  const seen = new Set();
  return list.filter((m) => m && !seen.has(m) && seen.add(m)).slice(0, 2);
}

function getKey() {
  return (process.env.XAI_API_KEY || "").trim();
}

function getBase() {
  return (process.env.XAI_BASE_URL || "https://api.x.ai/v1").replace(/\/$/, "");
}

function jsonResponse(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
    body: JSON.stringify(obj),
  };
}

function optionsResponse() {
  return {
    statusCode: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
    body: "",
  };
}

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  return JSON.parse(raw);
}

async function httpJson(url, payload, key, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "User-Agent": "RockQuestOahu/1.0",
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 1500) };
    }
    if (!res.ok) {
      const msg =
        data?.error?.message ||
        data?.error ||
        (typeof data?.raw === "string" ? data.raw : text.slice(0, 800));
      const err = new Error(`HTTP ${res.status}: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
      err.status = res.status;
      throw err;
    }
    return data;
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error("xAI request timed out — try a smaller/clearer photo");
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

function extractOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }
  const chunks = [];
  for (const item of data?.output || []) {
    if (!item || typeof item !== "object") continue;
    if (item.type === "message" || item.role === "assistant") {
      for (const c of item.content || []) {
        if (typeof c === "string") chunks.push(c);
        else if (c && typeof c === "object") {
          if (c.type === "output_text" || c.type === "text") chunks.push(c.text || "");
          else if (c.text) chunks.push(String(c.text));
        }
      }
    }
    for (const c of item.content || []) {
      if (c && typeof c === "object" && (c.type === "output_text" || c.type === "text")) {
        chunks.push(c.text || "");
      }
    }
  }
  if (chunks.length) return chunks.join("\n");
  const choices = data?.choices || [];
  if (choices[0]?.message?.content) {
    const content = choices[0].message.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((p) => (typeof p === "string" ? p : p?.text || ""))
        .join("\n");
    }
  }
  return "";
}

/**
 * Fast path: one chat-completions vision call, then optional responses fallback.
 * Avoids 6–8 sequential attempts that blow Netlify's time limit.
 */
async function callVision(key, imageDataUrl, userText) {
  const base = getBase();
  const models = getModelList();
  const errors = [];
  const system =
    SYSTEM_PROMPT +
    "\n\nIMPORTANT: Output exactly one JSON object. No markdown. No prose outside JSON.";

  for (const model of models) {
    // 1) Chat Completions (most reliable for data:image URLs)
    try {
      const payload = {
        model,
        temperature: 0.1,
        max_tokens: 1200,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: imageDataUrl, detail: "low" },
              },
              { type: "text", text: userText },
            ],
          },
        ],
      };
      const data = await httpJson(`${base}/chat/completions`, payload, key, 22000);
      let text = data?.choices?.[0]?.message?.content || "";
      if (Array.isArray(text)) {
        text = text.map((p) => (typeof p === "object" ? p?.text || "" : String(p))).join("\n");
      }
      if (text && String(text).trim()) {
        return { text: String(text), modelUsed: `chat:${model}` };
      }
      errors.push(`chat:${model}: empty text`);
    } catch (e) {
      errors.push(`chat:${model}: ${e.message || e}`);
      // Auth errors: stop immediately
      if (String(e.message || "").includes("HTTP 401") || String(e.message || "").includes("HTTP 403")) {
        throw new Error(
          "xAI rejected the API key (401/403). Check XAI_API_KEY in Netlify Environment variables and that the key is active at console.x.ai"
        );
      }
    }

    // 2) Responses API once for this model
    try {
      const payload = {
        model,
        temperature: 0.1,
        instructions: system,
        input: [
          {
            role: "user",
            content: [
              { type: "input_image", image_url: imageDataUrl, detail: "low" },
              { type: "input_text", text: userText },
            ],
          },
        ],
      };
      const data = await httpJson(`${base}/responses`, payload, key, 22000);
      const text = extractOutputText(data);
      if (text && text.trim()) return { text, modelUsed: `responses:${model}` };
      errors.push(`responses:${model}: empty text`);
    } catch (e) {
      errors.push(`responses:${model}: ${e.message || e}`);
      if (String(e.message || "").includes("HTTP 401") || String(e.message || "").includes("HTTP 403")) {
        throw new Error(
          "xAI rejected the API key (401/403). Check XAI_API_KEY in Netlify Environment variables."
        );
      }
    }
  }

  throw new Error("All vision attempts failed → " + errors.slice(0, 4).join(" | "));
}

function extractJson(text) {
  if (!text || !String(text).trim()) throw new Error("Empty model response");
  let s = String(text).trim();
  const fence = s.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  s = s
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'");

  const tryParse = (blob) => {
    try {
      return JSON.parse(blob);
    } catch {
      /* fall through */
    }
    const start = blob.indexOf("{");
    if (start < 0) throw new Error("No JSON object");
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let j = start; j < blob.length; j++) {
      const c = blob[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          return JSON.parse(blob.slice(start, j + 1));
        }
      }
    }
    throw new Error("Could not parse JSON object");
  };

  try {
    const obj = tryParse(s);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      throw new Error("JSON root must be object");
    }
    return obj;
  } catch {
    throw new Error(
      "Model did not return a parseable JSON object. Preview: " + String(text).slice(0, 400)
    );
  }
}

function buildUserText(body) {
  const foundOutside = !!body.foundOutside;
  const location = foundOutside ? body.location : null;

  let geoNote = "";
  if (
    foundOutside &&
    location &&
    typeof location === "object" &&
    location.lat != null &&
    location.lng != null
  ) {
    const place = (location.placeName || location.label || "").trim();
    const placeBit = place ? ` near ${place}` : "";
    geoNote =
      `\n\nOUTDOOR FIND CONTEXT (soft prior only): The kid says this was found outside${placeBit} ` +
      `(approx GPS ${location.lat}, ${location.lng}). ` +
      "You MAY gently prefer rocks that are plausible for that geography. " +
      "CRITICAL: Visual evidence ALWAYS wins.";
  }

  if (!foundOutside) {
    return (
      "Identify the rock or mineral in this photograph using VISUAL EVIDENCE ONLY. " +
      "Do NOT apply regional bias. Do not assume Hawaii. " +
      "Look at color, luster, crystal shape, polish, texture. " +
      "Reply with EXACTLY ONE JSON object matching the schema."
    );
  }

  return (
    "Identify the rock or mineral in this photograph. " +
    "Primary evidence is ALWAYS visual. " +
    "Do not default to basalt/scoria unless the photo shows volcanic lava rock." +
    geoNote +
    "\nReply with EXACTLY ONE JSON object matching the schema."
  );
}

/**
 * Downsize huge data URLs inside the function if the client sent a large photo.
 * Keeps base64 but strips to a shorter payload when possible (JPEG only).
 * (No re-encode without canvas; just pass through — client handles resize.)
 */
function assertImageOk(image) {
  if (typeof image !== "string" || !image.startsWith("data:image")) {
    throw new Error("Expected image as a data:image/...;base64,... URL");
  }
  // Prefer client to stay ~650KB; hard cap before Netlify gateway rejects
  if (image.length > 4_500_000) {
    throw new Error(
      "Image too large for the live server — crop closer to the rock and try again"
    );
  }
  // Strip accidental whitespace that breaks some parsers
  if (/\s/.test(image.slice(0, 100))) {
    throw new Error("Image data has invalid whitespace — re-save the photo and try again");
  }
}

module.exports = {
  SYSTEM_PROMPT,
  getKey,
  getModelList,
  getPrimaryModel,
  jsonResponse,
  optionsResponse,
  parseBody,
  callVision,
  extractJson,
  buildUserText,
  assertImageOk,
  getBase,
};
