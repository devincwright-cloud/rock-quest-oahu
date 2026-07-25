const { getKey, getModelList, jsonResponse, optionsResponse } = require("./_lib/vision");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const key = getKey();
  const models = getModelList();
  const model = models[0] || null;

  return jsonResponse(200, {
    vision: !!key,
    demo: !key,
    needsKey: !key,
    model: key ? model : null,
    modelsTried: key ? models : [],
    message: key
      ? `Live vision ready (${model})`
      : "Add XAI_API_KEY in Netlify Site settings → Environment variables",
    setupHint:
      "In Netlify: Site configuration → Environment variables → add XAI_API_KEY from https://console.x.ai then redeploy.",
    production: true,
  });
};
