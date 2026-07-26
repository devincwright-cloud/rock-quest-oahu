import { catalogById, normalizeRockId, normalizeRarity } from "./data/catalog.js";
import { normalizeFieldTests, testsForRock } from "./fieldtests.js";
import {
  compressForUpload,
  compressToBudget,
  sanitizeDataUrl,
  shrinkDataUrl,
  fileToDataUrl,
  MAX_IDENTIFY_BASE64_CHARS,
  MAX_PENDING_BASE64_CHARS,
} from "./media.js";

export {
  compressForUpload,
  compressToBudget,
  sanitizeDataUrl,
  shrinkDataUrl,
  fileToDataUrl,
  MAX_IDENTIFY_BASE64_CHARS,
  MAX_PENDING_BASE64_CHARS,
};

/** Client-side prompt is unused for ID (server owns the vision prompt). Kept for status/debug. */
export const SYSTEM_PROMPT = `Worldwide rock/mineral ID from photo only. No Hawaii bias. JSON only.`;

let visionStatusCache = null;

export async function getVisionStatus(force = false) {
  if (visionStatusCache && !force) return visionStatusCache;
  try {
    const res = await fetch("/api/status", { cache: "no-store" });
    if (res.ok) {
      visionStatusCache = await res.json();
      return visionStatusCache;
    }
  } catch {
    /* offline */
  }
  visionStatusCache = {
    vision: false,
    demo: false,
    needsKey: true,
    model: null,
    message: "Cannot reach Rock Quest Oahu server",
    setupHint:
      "If you're on the live site: set XAI_API_KEY in Netlify Environment variables. Locally: run python3 server.py with .env",
  };
  return visionStatusCache;
}

export function clearVisionStatusCache() {
  visionStatusCache = null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableError(err) {
  if (!err) return false;
  if (err.code === "needs_key") return false;
  if (err.code === "bad_image") return false;
  if (err.code === "offline" || err.code === "timeout" || err.code === "network") return true;
  if (err.code === "server_502" || err.code === "server_504" || err.code === "payload") return true;
  const msg = String(err.message || "").toLowerCase();
  if (/timed out|timeout|network|fetch|offline|failed to fetch|502|503|504|abort|too large|payload/i.test(msg)) {
    return true;
  }
  if (/401|403|api key|not configured|damaged|missing/i.test(msg)) return false;
  return err.code === "api_error";
}

/**
 * Prepare any photo (live or saved-for-later) for a successful Netlify → xAI call.
 */
export async function prepareIdentifyImage(dataUrl, { aggressive = false } = {}) {
  const clean = sanitizeDataUrl(dataUrl);
  if (!clean.startsWith("data:image")) {
    const err = new Error("Saved photo is missing or damaged — please take a new photo.");
    err.code = "bad_image";
    throw err;
  }
  const budget = aggressive ? Math.round(MAX_IDENTIFY_BASE64_CHARS * 0.7) : MAX_IDENTIFY_BASE64_CHARS;
  const side = aggressive ? 560 : 720;
  const quality = aggressive ? 0.45 : 0.52;
  return compressToBudget(clean, { maxChars: budget, maxSide: side, quality });
}

/**
 * @param {string} dataUrl
 * @param {{
 *   foundOutside?: boolean,
 *   location?: object | null,
 *   maxRetries?: number,
 *   fromPending?: boolean,
 *   onProgress?: (p: object) => void
 * }} [opts]
 */
export async function identifyRock(dataUrl, opts = {}) {
  const onProgress = typeof opts.onProgress === "function" ? opts.onProgress : () => {};
  const maxRetries = Math.max(1, opts.maxRetries ?? 4);
  const fromPending = !!opts.fromPending;
  const foundOutside = !!opts.foundOutside;
  // Only send lean location (avoid bloated/stale objects on pending photos)
  const location =
    foundOutside && opts.location && opts.location.lat != null
      ? {
          lat: Number(opts.location.lat),
          lng: Number(opts.location.lng),
          placeName: String(opts.location.placeName || "").slice(0, 80),
          label: String(opts.location.label || "").slice(0, 120),
        }
      : null;

  onProgress({
    stage: "compress",
    message: fromPending
      ? "Preparing your saved trail photo…"
      : "Compressing photo for upload…",
    pct: 8,
  });

  let prepared;
  try {
    prepared = await prepareIdentifyImage(dataUrl, { aggressive: fromPending });
  } catch (e) {
    e.code = e.code || "bad_image";
    throw e;
  }

  let image = prepared.dataUrl;
  let lastErr = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const basePct = 12 + ((attempt - 1) / maxRetries) * 70;
    const aggressive = fromPending || attempt > 1;
    if (attempt > 1) {
      onProgress({
        stage: "compress",
        message: `Making photo smaller for retry ${attempt}/${maxRetries}…`,
        pct: basePct,
      });
      try {
        prepared = await prepareIdentifyImage(dataUrl, { aggressive: true });
        // even smaller each retry
        const side = Math.max(280, 640 - attempt * 80);
        const q = Math.max(0.34, 0.5 - attempt * 0.05);
        prepared = await compressToBudget(dataUrl, {
          maxChars: Math.round(MAX_IDENTIFY_BASE64_CHARS * (0.85 - attempt * 0.1)),
          maxSide: side,
          quality: q,
        });
        image = prepared.dataUrl;
      } catch (e) {
        lastErr = e;
      }
    }

    onProgress({
      stage: attempt === 1 ? "upload" : "retry",
      message:
        attempt === 1
          ? fromPending
            ? "Uploading saved photo on Wi‑Fi…"
            : "Uploading photo…"
          : `Retry ${attempt}/${maxRetries} with a smaller photo…`,
      attempt,
      maxRetries,
      pct: basePct + 8,
      imageChars: image?.length,
    });

    const stillTimer = setTimeout(() => {
      onProgress({
        stage: "waiting",
        message: "Still working… the vision server is thinking.",
        attempt,
        maxRetries,
        pct: Math.min(90, basePct + 30),
      });
    }, 4000);

    try {
      const result = await identifyRockOnce(image, { foundOutside, location });
      clearTimeout(stillTimer);
      onProgress({ stage: "done", message: "Got it!", pct: 100 });
      return result;
    } catch (e) {
      clearTimeout(stillTimer);
      lastErr = e;
      console.warn("identify attempt failed", attempt, e.code, e.message, e.detail);
      if (!isRetryableError(e) || attempt >= maxRetries) throw e;
      onProgress({
        stage: "retry",
        message: humanRetryHint(e),
        attempt,
        maxRetries,
        pct: basePct + 5,
      });
      await sleep(500 + attempt * 400);
    }
  }
  throw lastErr || new Error("Identification failed");
}

function humanRetryHint(err) {
  const msg = String(err?.message || "");
  if (/502|504|timeout|timed out/i.test(msg)) {
    return "Server was slow — retrying with a smaller photo…";
  }
  if (/too large|payload|413/i.test(msg)) {
    return "Photo was too big — shrinking and retrying…";
  }
  if (/network|offline|fetch/i.test(msg)) {
    return "Connection glitch — trying again…";
  }
  return "Trying again…";
}

async function identifyRockOnce(image, { foundOutside, location }) {
  const clean = sanitizeDataUrl(image);
  if (!clean.startsWith("data:image")) {
    const err = new Error("Photo data is invalid — take a new photo.");
    err.code = "bad_image";
    throw err;
  }
  if (clean.length > MAX_IDENTIFY_BASE64_CHARS * 1.4) {
    const err = new Error(
      "Photo is still too large to upload. Crop closer to the rock and try again."
    );
    err.code = "payload";
    throw err;
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  // Client wait longer than Netlify function so we can read the real error body
  const timeoutMs = 70000;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let res;
  let rawText = "";
  try {
    res = await fetch("/api/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: clean,
        foundOutside: !!foundOutside,
        location: location || null,
        // help server logs
        client: "rock-quest-oahu",
        imageChars: clean.length,
      }),
      signal: controller?.signal,
    });
    rawText = await res.text();
  } catch (e) {
    if (timer) clearTimeout(timer);
    if (e?.name === "AbortError") {
      const err = new Error(
        "Request timed out waiting for the vision server. The photo may be large — we’ll shrink it on retry."
      );
      err.code = "timeout";
      throw err;
    }
    const err = new Error(
      "No connection to the identify server. Check Wi‑Fi, then try again."
    );
    err.code = "offline";
    throw err;
  }
  if (timer) clearTimeout(timer);

  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { raw: String(rawText || "").slice(0, 400) };
  }

  if (res.status === 503 || data.needsKey) {
    const err = new Error(
      data.setupHint ||
        data.error ||
        "Vision API key not configured. On Netlify: Environment variables → XAI_API_KEY → Redeploy."
    );
    err.code = "needs_key";
    err.setupHint = data.setupHint;
    throw err;
  }

  if (res.status === 413) {
    const err = new Error("Photo is too large for the server. Crop closer to the rock.");
    err.code = "payload";
    throw err;
  }

  if (!res.ok) {
    const serverMsg =
      data.error ||
      data.message ||
      data.hint ||
      (typeof data.raw === "string" && data.raw.trim() ? data.raw.trim().slice(0, 200) : "");

    let detail;
    if (res.status === 502 || res.status === 504) {
      detail =
        serverMsg ||
        "Vision server error (502). Often a timeout or oversized photo — retrying with a smaller image helps.";
    } else {
      detail = serverMsg || `Identify failed (HTTP ${res.status})`;
    }
    if (data.rawPreview) {
      detail += ` [${String(data.rawPreview).slice(0, 100)}]`;
    }
    if (data.modelTried) {
      detail += ` (model: ${data.modelTried})`;
    }

    const err = new Error(detail);
    err.code = res.status === 502 ? "server_502" : res.status === 504 ? "server_504" : "api_error";
    err.status = res.status;
    err.detail = data;
    throw err;
  }

  if (!data.result) {
    const err = new Error("Empty vision response from server — try again.");
    err.code = "api_error";
    err.detail = data;
    throw err;
  }

  return normalizeResult(data.result, {
    demo: false,
    mode: "live",
    model: data.model || null,
  });
}

/**
 * Strict photo-challenge check — must show the target subject, not just be near the place.
 */
export async function verifyChallengePhoto(dataUrl, { verifyTarget, placeName } = {}) {
  let image = dataUrl;
  try {
    const p = await compressToBudget(dataUrl, {
      maxChars: MAX_PENDING_BASE64_CHARS,
      maxSide: 640,
      quality: 0.5,
    });
    image = p.dataUrl;
  } catch {
    /* */
  }

  let res;
  let rawText = "";
  try {
    res = await fetch("/api/verify-challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image,
        target: verifyTarget,
        placeName: placeName || "",
      }),
    });
    rawText = await res.text();
  } catch {
    const err = new Error("No connection to verify the photo challenge.");
    err.code = "offline";
    throw err;
  }

  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = {};
  }
  if (!res.ok) {
    const err = new Error(data.error || `Challenge check failed (${res.status})`);
    err.code = data.needsKey ? "needs_key" : "api_error";
    throw err;
  }
  return {
    match: !!data.match,
    confidence: Number(data.confidence) || 0,
    seen: data.seen || "",
    reason: data.reason || "",
  };
}

export async function saveApiKey(key) {
  const res = await fetch("/api/set-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: key.trim() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not save key");
  clearVisionStatusCache();
  return data;
}

function normalizeResult(raw, meta = {}) {
  const candidates = (raw.candidates || []).slice(0, 3).map((c) => {
    const name = c.name || "Unknown rock";
    let rockId = normalizeRockId(c.rockId || name);
    const cat = catalogById(rockId);
    if (!cat && name) rockId = normalizeRockId(name);
    const rarity = normalizeRarity(c.rarity || cat?.rarity || "common");
    const confidence = clamp01(c.confidence);
    const fieldTests = normalizeFieldTests(c.fieldTests, rockId, name);
    return {
      name: cat?.name && rockId === cat.id ? cat.name : name,
      rockId,
      confidence,
      baseConfidence: confidence,
      rarity,
      properties: {
        hardness: c.properties?.hardness || "see field guide",
        luster: c.properties?.luster || "see photo",
        appearance: c.properties?.appearance || cat?.hint || "See photo",
      },
      facts: Array.isArray(c.facts) && c.facts.length
        ? c.facts.slice(0, 4)
        : cat
          ? [cat.hint, "Compare with a field guide or museum sample when you can."]
          : ["Look closely at color, shine, and crystal shape."],
      fieldTests: fieldTests.length ? fieldTests : testsForRock(rockId, name),
      fieldAnswers: {},
      valueNote:
        c.valueNote ||
        "Awesome for learning and your collection — not a treasure map to money!",
    };
  });

  if (!candidates.length) {
    throw new Error("Vision returned no rock candidates — try a clearer close-up photo.");
  }

  const seen = new Set();
  const unique = [];
  for (const c of candidates) {
    const key = c.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }

  return {
    demo: !!meta.demo,
    mode: meta.mode || "live",
    model: meta.model || null,
    needsKey: false,
    summary: raw.summary || "Here's what this rock might be!",
    candidates: unique.slice(0, 3),
    safetyNote:
      raw.safetyNote ||
      "Explore with a grown-up. Stay on public land and only take rocks if rules allow.",
  };
}

function clamp01(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 0.45;
  return Math.max(0.05, Math.min(0.98, x));
}
