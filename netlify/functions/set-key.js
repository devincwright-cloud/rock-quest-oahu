const { jsonResponse, optionsResponse, parseBody } = require("./_lib/vision");

/**
 * Local python server can write .env; on Netlify keys must be set in the dashboard.
 */
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  // Accept the request so the UI can show a clear production message
  let body = {};
  try {
    body = parseBody(event);
  } catch {
    /* ignore */
  }
  const key = (body.key || body.XAI_API_KEY || "").trim();
  if (!key || key.length < 10) {
    return jsonResponse(400, {
      error: "Paste a valid XAI_API_KEY from console.x.ai",
    });
  }

  return jsonResponse(400, {
    error:
      "On the live Netlify site, API keys cannot be saved from the phone. " +
      "A parent/admin must add XAI_API_KEY in Netlify → Site configuration → Environment variables, then Redeploy.",
    needsNetlifyEnv: true,
  });
};
