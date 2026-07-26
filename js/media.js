/**
 * Image compress helpers — tuned for Netlify function body limits
 * and xAI vision speed (especially "save for later" photos).
 */

/** Netlify request bodies should stay well under ~6MB; base64 is bulky. */
export const MAX_IDENTIFY_BASE64_CHARS = 650_000; // ~0.65MB string ≈ safer uploads
export const MAX_PENDING_BASE64_CHARS = 500_000;

export async function fileToDataUrl(file, maxSide = 720, quality = 0.55) {
  const bitmap = await createImageBitmap(file);
  try {
    return bitmapToJpegDataUrl(bitmap, maxSide, quality);
  } finally {
    bitmap.close?.();
  }
}

function bitmapToJpegDataUrl(bitmap, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height, 1));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Normalize data URLs that may have been stored with whitespace or odd prefixes.
 */
export function sanitizeDataUrl(dataUrl) {
  if (dataUrl == null) return "";
  let s = String(dataUrl).trim();
  // Remove accidental whitespace/newlines from storage
  s = s.replace(/\s+/g, "");
  if (!s) return "";
  if (!s.startsWith("data:")) {
    // Bare base64 — assume jpeg
    if (/^[A-Za-z0-9+/=]+$/.test(s.slice(0, 80))) {
      s = `data:image/jpeg;base64,${s}`;
    }
  }
  return s;
}

export async function shrinkDataUrl(dataUrl, maxSide = 720, quality = 0.55, force = false) {
  const clean = sanitizeDataUrl(dataUrl);
  if (!clean.startsWith("data:image")) {
    throw new Error("Photo data is missing or damaged — take a new photo.");
  }
  if (!force && clean.length < 400_000) return clean;

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () =>
      reject(new Error("Could not read saved photo — it may be damaged. Take a new one."));
    i.src = clean;
  });

  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || img.width || 1, img.naturalHeight || img.height || 1));
  const w = Math.max(1, Math.round((img.naturalWidth || img.width || 1) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || img.height || 1) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function compressForUpload(source, opts = {}) {
  const maxSide = opts.maxSide ?? 720;
  const quality = opts.quality ?? 0.55;
  if (typeof source === "string" && source.startsWith("data:image")) {
    return shrinkDataUrl(source, maxSide, quality, true);
  }
  // sanitized bare string
  if (typeof source === "string") {
    const clean = sanitizeDataUrl(source);
    if (clean.startsWith("data:image")) {
      return shrinkDataUrl(clean, maxSide, quality, true);
    }
  }
  if (typeof Blob !== "undefined" && source instanceof Blob) {
    return fileToDataUrl(source, maxSide, quality);
  }
  return source;
}

/**
 * Iteratively compress until under maxChars (base64 data-URL length).
 * Critical for saved-for-later photos that must re-upload cleanly on Wi‑Fi.
 */
export async function compressToBudget(dataUrl, opts = {}) {
  const maxChars = opts.maxChars ?? MAX_IDENTIFY_BASE64_CHARS;
  let side = opts.maxSide ?? 720;
  let quality = opts.quality ?? 0.55;
  const clean = sanitizeDataUrl(dataUrl);
  if (!clean.startsWith("data:image")) {
    throw new Error("Saved photo is missing or damaged — please take a new photo.");
  }

  let out = clean;
  let lastErr = null;
  for (let i = 0; i < 7; i++) {
    try {
      out = await shrinkDataUrl(clean, side, quality, true);
    } catch (e) {
      lastErr = e;
      // try smaller if decode failed once with original
      side = Math.max(240, Math.round(side * 0.75));
      quality = Math.max(0.32, quality - 0.08);
      continue;
    }
    if (out.length <= maxChars) {
      return {
        dataUrl: out,
        bytesApprox: Math.round(out.length * 0.75),
        chars: out.length,
        side,
        quality,
      };
    }
    side = Math.max(240, Math.round(side * 0.78));
    quality = Math.max(0.32, quality - 0.07);
  }

  if (out && out.startsWith("data:image") && out.length <= maxChars * 1.15) {
    // close enough — last attempt
    return {
      dataUrl: out,
      bytesApprox: Math.round(out.length * 0.75),
      chars: out.length,
      side,
      quality,
      oversized: out.length > maxChars,
    };
  }

  if (lastErr) throw lastErr;
  throw new Error(
    "Photo is still too large after compression. Take a closer crop of the rock and try again."
  );
}
