/** Image compress helpers shared by identify + adventure cameras */

export async function fileToDataUrl(file, maxSide = 800, quality = 0.62) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}

export async function shrinkDataUrl(dataUrl, maxSide = 800, quality = 0.62, force = false) {
  if (!dataUrl || !dataUrl.startsWith("data:image")) return dataUrl;
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

export async function compressForUpload(source, opts = {}) {
  const maxSide = opts.maxSide ?? 800;
  const quality = opts.quality ?? 0.62;
  if (typeof source === "string" && source.startsWith("data:image")) {
    return shrinkDataUrl(source, maxSide, quality, true);
  }
  if (typeof Blob !== "undefined" && source instanceof Blob) {
    return fileToDataUrl(source, maxSide, quality);
  }
  return source;
}
