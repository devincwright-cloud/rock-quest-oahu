const {
  getKey,
  jsonResponse,
  optionsResponse,
  parseBody,
  callVision,
  extractJson,
  buildUserText,
} = require("./_lib/vision");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  let body;
  try {
    body = parseBody(event);
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const image = body.image || "";
  if (typeof image !== "string" || !image.startsWith("data:image")) {
    return jsonResponse(400, {
      error: "Expected image as a data:image/...;base64,... URL",
    });
  }
  if (image.length > 12_000_000) {
    return jsonResponse(400, { error: "Image too large — try a smaller photo" });
  }

  const key = getKey();
  if (!key) {
    return jsonResponse(503, {
      error: "Vision API key not configured",
      needsKey: true,
      demo: false,
      setupHint:
        "Add XAI_API_KEY in Netlify → Site configuration → Environment variables (from console.x.ai), then redeploy.",
    });
  }

  const userText = buildUserText(body);
  let rawText = "";
  let modelUsed = "";

  try {
    const { text, modelUsed: used } = await callVision(key, image, userText);
    rawText = text || "";
    modelUsed = used;
    const result = extractJson(rawText);
    if (!result || !Array.isArray(result.candidates) || !result.candidates.length) {
      throw new Error("Model JSON missing candidates");
    }
    result.candidates = result.candidates.slice(0, 3);
    return jsonResponse(200, {
      result,
      demo: false,
      needsKey: false,
      model: modelUsed,
    });
  } catch (e) {
    console.error("Identify failed", modelUsed, e);
    return jsonResponse(502, {
      error: `Vision API failed: ${e.message || e}`,
      needsKey: false,
      demo: false,
      hint: "Check XAI_API_KEY, model name, and API credits at console.x.ai",
      rawPreview: (rawText || "").slice(0, 800),
    });
  }
};
