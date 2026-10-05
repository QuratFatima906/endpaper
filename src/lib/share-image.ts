import { domToBlob } from "modern-screenshot";

// "Save as image": a pixel copy of what the reader sees in the preview (layout, fonts,
// hand-drawn edges, cover, current light/dark theme). The node must contain <RoughDefs/>
// so the SVG filters resolve inside the captured copy.

const COVER_HOSTS = /(^|\.)(openlibrary\.org|archive\.org|books\.google\.com|books\.googleusercontent\.com)$/;

const toDataUrl = (blob: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });

export async function captureImage(node: HTMLElement): Promise<Blob> {
  await document.fonts.ready;
  const blob = await domToBlob(node, {
    scale: Math.max(2, window.devicePixelRatio || 1),
    backgroundColor: getComputedStyle(document.body).backgroundColor,
    // Covers from hosts without CORS headers go through our same-origin proxy.
    fetchFn: async (url) => {
      const u = new URL(url, location.href);
      if (u.origin === location.origin || !COVER_HOSTS.test(u.hostname)) return false;
      const res = await fetch(`/api/cover?u=${encodeURIComponent(u.href)}`);
      return res.ok ? toDataUrl(await res.blob()) : false;
    },
  });
  if (!blob) throw new Error("Couldn't make the image");
  return blob;
}

/**
 * Called from a click so the browser allows the picker/share sheet.
 * Chrome/Edge: "Save as" dialog. Phones: share sheet (Save Image lives there).
 * Elsewhere: a plain download, which goes wherever the browser saves downloads.
 */
export async function saveImage(blob: Blob, name: string) {
  const w = window as unknown as { showSaveFilePicker?: (o: object) => Promise<FileSystemFileHandle> };
  if (w.showSaveFilePicker) {
    try {
      const handle = await w.showSaveFilePicker({ suggestedName: name, types: [{ description: "PNG image", accept: { "image/png": [".png"] } }] });
      const out = await handle.createWritable();
      await out.write(blob);
      await out.close();
    } catch (e) {
      if ((e as Error).name !== "AbortError") throw e; // AbortError = user cancelled
    }
    return;
  }
  const file = new File([blob], name, { type: "image/png" });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file] }).catch((e: Error) => {
      if (e.name !== "AbortError") throw e;
    });
    return;
  }
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
