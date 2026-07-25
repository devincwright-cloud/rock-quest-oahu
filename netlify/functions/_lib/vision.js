/**
 * Shared xAI vision helpers for Netlify functions.
 * Port of rock-quest/server.py identify logic.
 */

const SYSTEM_PROMPT = `You are Rock Quest Oahu's expert geology field-guide for kids (ages 7–14) and parents.
Identify rocks and minerals from a PHOTO accurately.

SCOPE (CRITICAL):
- Identify specimens from ANYWHERE in the world.
- Default: NO regional bias. Only if the user message includes "OUTDOOR FIND CONTEXT" may you use geography as a SOFT prior.
- Even with outdoor context, visual evidence ALWAYS overrides location (never force basalt/scoria over clear pyrite/quartz/etc.).
- Do NOT default to basalt or scoria. Those are only correct when the photo actually looks like volcanic lava rock.
- Kids often photograph: field finds, polished/tumbled stones, and rock-shop specimens. Identify those correctly too.

OUTPUT FORMAT (MANDATORY):
- Reply with EXACTLY ONE JSON object. Nothing else.
- No markdown fences (no \`\`\`). No text before or after the JSON. No second object.
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
4. If polished/tumbled/store-bought: still identify the mineral/rock — do NOT reclassify as basalt/scoria.
5. Top 2–3 candidates that fit THIS photo; confidences 0–1, best first. Prefer specific names.
6. rarity: common | uncommon | rare | ultra
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
      "properties": { "hardness": "6–6.5", "luster": "metallic", "appearance": "brassy gold, often cubic" },
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

function getModelList() {
  const primary = (process.env.XAI_VISION_MODEL || "grok-4.5").trim();
  const list = [primary, "grok-4.5", "grok-2-vision-latest", "grok-2-vision-1212"];
  const seen = new Set();
  return list.filter((m) => m && !seen.has(m) && seen.add(m));
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

async function httpJson(url, payload, key, timeoutMs = 90000) {
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
      data = { raw: text.slice(0, 2000) };
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 2000)}`);
    }
    return data;
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

async function callVision(key, imageDataUrl, userText) {
  const base = getBase();
  const models = getModelList();
  const errors = [];

  for (const model of models) {
    // Responses API
    try {
      const payload = {
        model,
        temperature: 0.1,
        instructions:
          SYSTEM_PROMPT +
          "\n\nIMPORTANT: Output exactly one JSON object. No markdown. No prose outside JSON.",
        input: [
          {
            role: "user",
            content: [
              { type: "input_image", image_url: imageDataUrl, detail: "high" },
              { type: "input_text", text: userText },
            ],
          },
        ],
      };
      const data = await httpJson(`${base}/responses`, payload, key);
      const text = extractOutputText(data);
      if (text && text.trim()) return { text, modelUsed: `responses:${model}` };
      errors.push(`responses:${model}: empty text`);
    } catch (e) {
      errors.push(`responses:${model}: ${e.message || e}`);
    }

    // Chat Completions
    try {
      const payload = {
        model,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              SYSTEM_PROMPT +
              "\n\nIMPORTANT: Output exactly one JSON object. No markdown. No prose outside JSON.",
          },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
              { type: "text", text: userText },
            ],
          },
        ],
      };
      const data = await httpJson(`${base}/chat/completions`, payload, key);
      let text = data?.choices?.[0]?.message?.content || "";
      if (Array.isArray(text)) {
        text = text.map((p) => (typeof p === "object" ? p?.text || "" : String(p))).join("\n");
      }
      if (text && String(text).trim()) return { text: String(text), modelUsed: `chat:${model}` };
      errors.push(`chat:${model}: empty text`);
    } catch (e) {
      errors.push(`chat:${model}: ${e.message || e}`);
    }
  }

  throw new Error("All vision attempts failed → " + errors.slice(0, 6).join(" | "));
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
    // Use JSON.parse; if trailing junk, find balanced object
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
  } catch (e) {
    throw new Error("Model did not return a parseable JSON object. Preview: " + String(text).slice(0, 400));
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
      "You MAY gently prefer rocks that are plausible for that geography/geology. " +
      "CRITICAL: Visual evidence ALWAYS wins. Do not invent a local ID that contradicts the photo.";
  }

  if (!foundOutside) {
    return (
      "Identify the rock or mineral in this photograph using VISUAL EVIDENCE ONLY. " +
      "Do NOT apply any regional or location bias. Do not assume Hawaii, beach, or volcano. " +
      "Look carefully at color, luster (metallic vs glassy), crystal shape, polish/tumble, texture, and transparency. " +
      "If it looks like pyrite, quartz, amethyst, citrine, agate, jasper, or another rock-shop/specimen stone, name that. " +
      "Do not default to basalt or scoria unless the photo clearly shows volcanic lava rock. " +
      "Reply with EXACTLY ONE JSON object matching the schema — no markdown, no extra commentary, no second object."
    );
  }

  return (
    "Identify the rock or mineral in this photograph. " +
    "Primary evidence is ALWAYS what you see: color, luster (metallic vs glassy), crystal shape, " +
    "polish/tumble, texture, and transparency. " +
    "Identify specimens from anywhere in the world. " +
    "If it looks like pyrite, quartz (clear/rose/smoky), amethyst, citrine, agate, jasper, " +
    "or other rock-shop/polished stones, name those correctly. " +
    "Do not default to basalt or scoria unless the photo clearly shows volcanic lava rock." +
    geoNote +
    "\nReply with EXACTLY ONE JSON object matching the schema — no markdown, no extra commentary, no second object."
  );
}

module.exports = {
  SYSTEM_PROMPT,
  getKey,
  getModelList,
  jsonResponse,
  optionsResponse,
  parseBody,
  callVision,
  extractJson,
  buildUserText,
};
