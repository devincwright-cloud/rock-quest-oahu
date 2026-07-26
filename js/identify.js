import { catalogById, normalizeRockId, normalizeRarity } from "./data/catalog.js";
import { normalizeFieldTests, testsForRock } from "./fieldtests.js";

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
  if (err.code === "offline") return true;
  if (err.code === "timeout") return true;
  if (err.code === "network") return true;
  const msg = String(err.message || "").toLowerCase();
  if (/timed out|timeout|network|fetch|offline|failed to fetch|502|503|504|abort/i.test(msg)) {
    return true;
  }
  // Don't retry clear client/auth errors
  if (/401|403|api key|not configured|too large|invalid json/i.test(msg)) return false;
  return err.code === "api_error";
}

/**
 * Always compress for upload — better chance on weak cell signal.
 * @param {string|File|Blob} source data URL or File
 * @param {{ maxSide?: number, quality?: number }} [opts]
 */
export async function compressForUpload(source, opts = {}) {
  const maxSide = opts.maxSide ?? 800;
  const quality = opts.quality ?? 0.62;

  if (typeof source === "string" && source.startsWith("data:image")) {
    return shrinkDataUrl(source, maxSide, quality, true);
  }
  if (source instanceof Blob || (typeof File !== "undefined" && source instanceof File)) {
    return fileToDataUrl(source, maxSide, quality);
  }
  return source;
}

export async function fileToDataUrl(file, maxSide = 800, quality = 0.62) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}

/** Shrink an existing data URL (e.g. camera snap) before sending to the API */
export async function shrinkDataUrl(dataUrl, maxSide = 800, quality = 0.62, force = false) {
  if (!dataUrl || !dataUrl.startsWith("data:image")) return dataUrl;
  // Skip only if already small unless force (always compress for identify)
  if (!force && dataUrl.length < 450_000) return dataUrl;
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
  const w = Math.max(1, Math.round((img.width || 1) * scale));
  const h = Math.max(1, Math.round((img.height || 1) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * @param {string} dataUrl
 * @param {{
 *   foundOutside?: boolean,
 *   location?: object | null,
 *   maxRetries?: number,
 *   onProgress?: (p: { stage: string, message: string, attempt?: number, maxRetries?: number, pct?: number }) => void
 * }} [opts]
 */
export async function identifyRock(dataUrl, opts = {}) {
  const onProgress = typeof opts.onProgress === "function" ? opts.onProgress : () => {};
  const maxRetries = Math.max(1, opts.maxRetries ?? 3);
  const foundOutside = !!opts.foundOutside;
  const location =
    foundOutside && opts.location && opts.location.lat != null
      ? {
          lat: opts.location.lat,
          lng: opts.location.lng,
          placeName: opts.location.placeName || "",
          label: opts.location.label || "",
        }
      : null;

  onProgress({
    stage: "compress",
    message: "Compressing photo for weak signal…",
    pct: 8,
  });

  let image;
  try {
    image = await compressForUpload(dataUrl, { maxSide: 800, quality: 0.62 });
  } catch {
    image = dataUrl;
  }

  let lastErr = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const basePct = 15 + ((attempt - 1) / maxRetries) * 70;
    onProgress({
      stage: attempt === 1 ? "upload" : "retry",
      message:
        attempt === 1
          ? "Uploading photo…"
          : `Weak signal — retry ${attempt} of ${maxRetries}…`,
      attempt,
      maxRetries,
      pct: basePct,
    });

    let stillTimer = setTimeout(() => {
      onProgress({
        stage: "waiting",
        message: "Still working… hang tight!",
        attempt,
        maxRetries,
        pct: Math.min(88, basePct + 25),
      });
    }, 3500);

    let studyingTimer = setTimeout(() => {
      onProgress({
        stage: "identify",
        message: "Studying your rock…",
        attempt,
        maxRetries,
        pct: Math.min(92, basePct + 40),
      });
    }, 7000);

    try {
      const result = await identifyRockOnce(image, { foundOutside, location });
      clearTimeout(stillTimer);
      clearTimeout(studyingTimer);
      onProgress({ stage: "done", message: "Got it!", pct: 100 });
      return result;
    } catch (e) {
      clearTimeout(stillTimer);
      clearTimeout(studyingTimer);
      lastErr = e;
      if (!isRetryableError(e) || attempt >= maxRetries) {
        throw e;
      }
      onProgress({
        stage: "retry",
        message: `Connection glitch — trying again…`,
        attempt,
        maxRetries,
        pct: basePct + 10,
      });
      // Aggressive recompress for next try
      try {
        image = await compressForUpload(dataUrl, {
          maxSide: attempt === 1 ? 720 : 640,
          quality: attempt === 1 ? 0.55 : 0.48,
        });
      } catch {
        /* keep previous image */
      }
      await sleep(700 * attempt);
    }
  }
  throw lastErr || new Error("Identification failed");
}

async function identifyRockOnce(image, { foundOutside, location }) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutMs = 55000;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let res;
  try {
    res = await fetch("/api/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image,
        foundOutside,
        location,
      }),
      signal: controller?.signal,
    });
  } catch (e) {
    if (timer) clearTimeout(timer);
    if (e?.name === "AbortError") {
      const err = new Error("Request timed out — weak signal? Try Save for later.");
      err.code = "timeout";
      throw err;
    }
    const err = new Error(
      "No connection — Save for later, or try again when signal is better."
    );
    err.code = "offline";
    throw err;
  }
  if (timer) clearTimeout(timer);

  const data = await res.json().catch(() => ({}));

  if (res.status === 503 || data.needsKey) {
    const err = new Error(
      data.setupHint ||
        data.error ||
        "Vision API key not configured. On Netlify: Site settings → Environment variables → XAI_API_KEY."
    );
    err.code = "needs_key";
    err.setupHint = data.setupHint;
    throw err;
  }

  if (!res.ok) {
    const detail = data.error || data.hint || `Identify failed (${res.status})`;
    const err = new Error(detail);
    err.code = res.status >= 500 ? "api_error" : "api_error";
    err.status = res.status;
    err.detail = data;
    throw err;
  }

  if (!data.result) {
    const err = new Error("Empty vision response from server");
    err.code = "api_error";
    throw err;
  }

  return normalizeResult(data.result, {
    demo: false,
    mode: "live",
    model: data.model || null,
  });
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
    if (!cat && name) {
      rockId = normalizeRockId(name);
    }
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
