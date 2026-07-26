/**
 * Save / share photos to the device Photos app (via Share sheet or download).
 * Works on iPhone Safari/PWA and Android Chrome when the browser allows it.
 */

function dataUrlToBlob(dataUrl) {
  const [header, b64] = String(dataUrl).split(",");
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

function slug(s) {
  return String(s || "adventure")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "adventure";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
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
  const filename = opts.filename || `rock-quest-oahu-${Date.now()}.${ext}`;
  const title = opts.title || "Rock Quest Oahu";

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
  } catch (e) {
    if (e?.name === "AbortError") return "cancelled";
  }

  downloadBlob(blob, filename);
  return "downloaded";
}

/**
 * Export a whole adventure album to the phone.
 * Prefers multi-file share; otherwise downloads each photo with a short pause.
 * @param {{ dataUrl: string, id?: string }[]} photos
 * @param {{ title?: string, albumName?: string, onProgress?: (i: number, n: number) => void }} [opts]
 */
export async function shareOrSaveAlbum(photos, opts = {}) {
  const list = (photos || []).filter((p) => p?.dataUrl?.startsWith?.("data:image"));
  if (!list.length) throw new Error("No photos in this album");

  const albumName = slug(opts.albumName || opts.title || "adventure");
  const title = opts.title || "Rock Quest Oahu adventure";
  const onProgress = opts.onProgress || (() => {});

  const files = list.map((p, i) => {
    const blob = dataUrlToBlob(p.dataUrl);
    const ext = extForMime(blob.type);
    return new File([blob], `${albumName}-${String(i + 1).padStart(2, "0")}.${ext}`, {
      type: blob.type,
    });
  });

  // Multi-file share (iOS 15+ / many Android) — best path into Photos
  try {
    if (navigator.share && navigator.canShare?.({ files })) {
      await navigator.share({
        files,
        title,
        text: `${title} · ${files.length} photos`,
      });
      return { mode: "shared", count: files.length };
    }
  } catch (e) {
    if (e?.name === "AbortError") return { mode: "cancelled", count: 0 };
    // fall through to one-by-one
  }

  // Try sharing one-by-one (some browsers only allow a single file)
  if (navigator.share && navigator.canShare) {
    let shared = 0;
    for (let i = 0; i < files.length; i++) {
      onProgress(i + 1, files.length);
      try {
        if (navigator.canShare({ files: [files[i]] })) {
          await navigator.share({
            files: [files[i]],
            title: `${title} (${i + 1}/${files.length})`,
          });
          shared++;
          // small pause so the next share sheet can open
          await sleep(400);
        }
      } catch (e) {
        if (e?.name === "AbortError") {
          // user cancelled mid-way — stop
          return { mode: shared ? "partial" : "cancelled", count: shared };
        }
      }
    }
    if (shared) return { mode: "shared", count: shared };
  }

  // Download each file
  for (let i = 0; i < files.length; i++) {
    onProgress(i + 1, files.length);
    downloadBlob(files[i], files[i].name);
    await sleep(350);
  }
  return { mode: "downloaded", count: files.length };
}

export function canShareFiles() {
  try {
    const f = new File([new Blob(["x"])], "t.txt", { type: "text/plain" });
    return !!(navigator.share && navigator.canShare?.({ files: [f] }));
  } catch {
    return !!navigator.share;
  }
}
