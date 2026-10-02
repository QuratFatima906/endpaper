// Resize + re-encode through a canvas. Re-encoding drops all EXIF, including GPS (R-ENG-3).

export async function prepareImage(
  file: Blob,
  opts: { maxSide?: number; crop?: { x: number; y: number; w: number; h: number }; enhance?: boolean } = {},
): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const c = opts.crop ?? { x: 0, y: 0, w: 1, h: 1 }; // fractions of the image
  const sx = c.x * bmp.width,
    sy = c.y * bmp.height,
    sw = c.w * bmp.width,
    sh = c.h * bmp.height;
  const max = opts.maxSide ?? 1600;
  const scale = Math.min(1, max / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d")!;
  // R-PAS-3: a gentle lift for low-light photos of paper.
  if (opts.enhance) ctx.filter = "contrast(1.25) brightness(1.08) saturate(0.9)";
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/jpeg", 0.85));
}

/** On-device OCR (R-PAS-4). Loaded lazily; the language data is cached by the service worker. */
export async function extractText(img: Blob): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(img);
    return data.text.replace(/-\n/g, "").replace(/\s*\n\s*/g, " ").trim();
  } finally {
    await worker.terminate();
  }
}
