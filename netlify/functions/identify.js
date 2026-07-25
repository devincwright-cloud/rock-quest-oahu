const {
  getKey,
  jsonResponse,
  optionsResponse,
  parseBody,
  callVision,
  extractJson,
  buildUserText,
  assertImageOk,
  getPrimaryModel,
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
  try {
    assertImageOk(image);
  } catch (e) {
    return jsonResponse(400, { error: e.message || String(e) });
  }

  const key = getKey();
  if (!key) {
    return jsonResponse(503, {
      error: "Vision API key not configured",
      needsKey: true,
      demo: false,
      setupHint:
        "Add XAI_API_KEY in Netlify → Site configuration → Environment variables, then Redeploy the site.",
    });
  }

  // Soft check: key shape
  if (!key.startsWith("xai-") && key.length < 20) {
    return jsonResponse(503, {
      error: "XAI_API_KEY looks invalid",
      needsKey: true,
      setupHint: "Keys from console.x.ai usually start with xai- … Double-check the Netlify env value (no quotes/spaces).",
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
    const msg = e.message || String(e);
    console.error("Identify failed", modelUsed, msg);
    return jsonResponse(502, {
      error: `Vision API failed: ${msg}`,
      needsKey: /401|403|API key/i.test(msg),
      demo: false,
      modelTried: getPrimaryModel(),
      hint:
        "In Netlify: confirm XAI_API_KEY is set, then Redeploy. " +
        "Also try a smaller/clearer photo. Check function logs under Netlify → Functions → identify.",
      rawPreview: (rawText || "").slice(0, 500),
    });
  }
};
