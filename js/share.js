/**
 * Save / share photos to the device Photos app (via Share sheet or download).
 * Works on iPhone Safari/PWA and Android Chrome when the browser allows it.
 */

function dataUrlToBlob(dataUrl) {
  const [header, b64] = dataUrl.split(",");
  const mime = (header.match(/data:([^;]+)/) || [])[1] || "image/jpeg";
  const bin = atob(b64 || "");
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function extForMime(mime) {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

/**
 * @param {string} dataUrl
 * @param {{ title?: string, filename?: string }} [opts]
 * @returns {Promise<'shared'|'downloaded'|'cancelled'>}
 */
export async function shareOrSavePhoto(dataUrl, opts = {}) {
  if (!dataUrl || !String(dataUrl).startsWith("data:image")) {
    throw new Error("No photo to save");
  }
  const blob = dataUrlToBlob(dataUrl);
  const ext = extForMime(blob.type);
  const filename =
    opts.filename ||
    `rock-quest-oahu-${Date.now()}.${ext}`;
  const title = opts.title || "Rock Quest Oahu";

  // Prefer Web Share API with files (saves to Photos on iOS/Android share sheet)
  try {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title,
        text: title,
      });
      return "shared";
    }
    if (navigator.share) {
      // Share URL fallback (some browsers)
      await navigator.share({ title, text: title, url: dataUrl.slice(0, 100) + "…" });
    }
  } catch (e) {
    if (e?.name === "AbortError") return "cancelled";
    // fall through to download
  }

  // Download / open — on mobile often offers “Save Image”
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
  return "downloaded";
}

export function canShareFiles() {
  try {
    const f = new File([new Blob(["x"])], "t.txt", { type: "text/plain" });
    return !!(navigator.share && navigator.canShare?.({ files: [f] }));
  } catch {
    return !!navigator.share;
  }
}
