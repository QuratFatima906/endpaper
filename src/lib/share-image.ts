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

/** Hand the image to the phone's share sheet, or download it on desktop. */
export async function shareOrDownload(blob: Blob, name: string, title: string) {
  const file = new File([blob], name, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // user closed the sheet
    }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
