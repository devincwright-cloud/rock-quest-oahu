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

export async function fileToDataUrl(file, maxSide = 1280, quality = 0.85) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Real vision identify via server → xAI.
 * Does NOT invent fake rock lists when the key is missing.
 */
/**
 * @param {string} dataUrl
 * @param {{ foundOutside?: boolean, location?: { lat: number, lng: number, placeName?: string, label?: string } | null }} [opts]
 * Location is only sent when foundOutside is true (soft geographic prior).
 */
export async function identifyRock(dataUrl, opts = {}) {
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

  let res;
  try {
    res = await fetch("/api/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: dataUrl,
        foundOutside,
        location,
      }),
    });
  } catch {
    const err = new Error(
      "Cannot reach Rock Quest Oahu. Check your internet, or locally run python3 server.py."
    );
    err.code = "offline";
    throw err;
  }

  const data = await res.json().catch(() => ({}));

  if (res.status === 503 || data.needsKey) {
    const err = new Error(
      data.setupHint ||
        data.error ||
        "Vision API key not configured. On Netlify: Site settings → Environment variables → XAI_API_KEY. Locally: rock-quest/.env"
    );
    err.code = "needs_key";
    err.setupHint = data.setupHint;
    throw err;
  }

  if (!res.ok) {
    const err = new Error(data.error || data.hint || `Identify failed (${res.status})`);
    err.code = "api_error";
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
    // Prefer model name if catalog match is wrong/generic
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

  // Deduplicate identical names while keeping order
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
