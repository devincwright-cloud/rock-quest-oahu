/**
 * Vision check: does this photo match the challenge target
 * (e.g. red-roofed lighthouse) — not merely "taken near the trail"?
 */
const visionLib = require("./_lib/vision");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return visionLib.optionsResponse();
  if (event.httpMethod !== "POST") {
    return visionLib.jsonResponse(405, { error: "Method not allowed" });
  }

  let body;
  try {
    body = visionLib.parseBody(event);
  } catch {
    return visionLib.jsonResponse(400, { error: "Invalid JSON body" });
  }

  const image = body.image || "";
  const target = (body.target || body.verifyTarget || "").trim();
  const placeName = (body.placeName || "").trim();

  if (typeof image !== "string" || !image.startsWith("data:image")) {
    return visionLib.jsonResponse(400, { error: "Expected image data URL" });
  }
  if (!target) {
    return visionLib.jsonResponse(400, { error: "Missing challenge target description" });
  }
  if (image.length > 5_500_000) {
    return visionLib.jsonResponse(400, { error: "Image too large — crop closer to the subject" });
  }

  const key = visionLib.getKey();
  if (!key) {
    return visionLib.jsonResponse(503, {
      error: "Vision API key not configured",
      needsKey: true,
    });
  }

  const model = visionLib.getPrimaryModel();
  const system = `You verify kids' outdoor photo challenges for Rock Quest Oahu.
Decide if the PHOTO clearly shows the REQUIRED SUBJECT.
Be strict: scenery near the place is NOT enough unless the required subject is visible.
Reply with EXACTLY one JSON object:
{"match":true|false,"confidence":0.0-1.0,"seen":"short description of main subject","reason":"one kid-friendly sentence"}`;

  const userText = `REQUIRED SUBJECT: ${target}
PLACE (context only): ${placeName || "Oahu outdoor spot"}

Does this photo clearly show the REQUIRED SUBJECT?
- match=true only if the required thing is actually visible (e.g. a red-roofed lighthouse, not just trail rocks or sky).
- If unsure or only general scenery, match=false.
JSON only.`;

  try {
    const base = visionLib.getBase();
    const payload = {
      model,
      temperature: 0,
      max_tokens: 250,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: image, detail: "low" } },
            { type: "text", text: userText },
          ],
        },
      ],
    };

    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const raw = await res.text();
    if (!res.ok) {
      return visionLib.jsonResponse(502, {
        error: `Vision verify failed: HTTP ${res.status}`,
        match: false,
        rawPreview: raw.slice(0, 400),
      });
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return visionLib.jsonResponse(502, {
        error: "Bad vision response",
        match: false,
        rawPreview: raw.slice(0, 400),
      });
    }
    let text = data?.choices?.[0]?.message?.content || "";
    if (Array.isArray(text)) {
      text = text.map((p) => (typeof p === "object" ? p?.text || "" : String(p))).join("\n");
    }

    let parsed;
    try {
      parsed = visionLib.extractJson(String(text));
    } catch {
      return visionLib.jsonResponse(200, {
        match: false,
        confidence: 0,
        seen: "",
        reason: "Could not read the vision check — try a clearer photo of the target.",
        model: `chat:${model}`,
      });
    }

    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    const match = !!parsed.match && confidence >= 0.55;

    return visionLib.jsonResponse(200, {
      match,
      confidence,
      seen: parsed.seen || "",
      reason: parsed.reason || (match ? "Looks like a match!" : "Not clearly the required subject."),
      model: `chat:${model}`,
    });
  } catch (e) {
    console.error("verify-challenge", e);
    return visionLib.jsonResponse(502, {
      error: e.message || String(e),
      match: false,
    });
  }
};
