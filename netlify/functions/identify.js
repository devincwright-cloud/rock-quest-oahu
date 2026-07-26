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

  // Platform body-size / gateway issues surface as empty 502s — surface payload size early
  const rawLen = event.body ? String(event.body).length : 0;
  if (rawLen > 5_500_000) {
    return jsonResponse(413, {
      error: "Photo payload too large for the server. Crop closer to the rock and try again.",
      code: "payload_too_large",
      rawLen,
    });
  }

  let body;
  try {
    body = parseBody(event);
  } catch (e) {
    return jsonResponse(400, {
      error: "Could not read the photo request (invalid JSON). Try saving the photo again.",
      code: "bad_json",
      detail: String(e.message || e).slice(0, 200),
    });
  }

  const image = body.image || "";
  try {
    assertImageOk(image);
  } catch (e) {
    return jsonResponse(400, {
      error: e.message || String(e),
      code: "bad_image",
    });
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

  if (!key.startsWith("xai-") && key.length < 20) {
    return jsonResponse(503, {
      error: "XAI_API_KEY looks invalid",
      needsKey: true,
      setupHint:
        "Keys from console.x.ai usually start with xai- … Double-check the Netlify env value (no quotes/spaces).",
    });
  }

  // Lean location only
  const leanBody = {
    foundOutside: !!body.foundOutside,
    location:
      body.location && body.location.lat != null
        ? {
            lat: body.location.lat,
            lng: body.location.lng,
            placeName: body.location.placeName || "",
            label: body.location.label || "",
          }
        : null,
  };

  const userText = buildUserText(leanBody);
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
    console.error("Identify failed", {
      modelUsed,
      msg,
      imageChars: typeof image === "string" ? image.length : 0,
      clientImageChars: body.imageChars,
      rawLen,
    });

    const isAuth = /401|403|API key|Unauthorized/i.test(msg);
    const isTimeout = /timed out|timeout|AbortError/i.test(msg);

    return jsonResponse(isAuth ? 503 : 502, {
      error: isTimeout
        ? "Vision timed out — photo may be large or the model is slow. Client will retry smaller."
        : `Vision API failed: ${msg}`,
      needsKey: isAuth,
      demo: false,
      modelTried: getPrimaryModel(),
      code: isTimeout ? "vision_timeout" : isAuth ? "auth" : "vision_error",
      imageChars: typeof image === "string" ? image.length : 0,
      hint: isAuth
        ? "Check XAI_API_KEY in Netlify Environment variables and redeploy."
        : "Try a closer crop of the rock. Saved trail photos are re-compressed automatically on retry.",
      rawPreview: (rawText || "").slice(0, 400),
    });
  }
};
