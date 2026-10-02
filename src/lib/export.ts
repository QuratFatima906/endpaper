import { db, SYNC_TABLES } from "./db";
import { now } from "./repo";
import { loadImage } from "./sync";

const strip = (row: object) => Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith("_")));

/** R-DAT-2: every live row plus every photo, as a ZIP the reader keeps. */
export async function exportZip(): Promise<{ blob: Blob; missing: number }> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const data: Record<string, unknown> = { app: "endpaper", format: 1, exported_at: now() };
  for (const t of SYNC_TABLES) data[t] = (await db[t].toArray()).filter((r) => !r.deleted_at).map(strip);
  data.profile = (data.profiles as unknown[])[0] ?? null;
  delete data.profiles;

  // Photos: local files plus any a passage points at that were taken on another device.
  const passages = data.passages as { image_id: string | null }[];
  const files = await db.files.filter((f) => !f.deleted).toArray();
  const ids = new Set([...files.map((f) => f.id), ...passages.flatMap((p) => (p.image_id ? [p.image_id] : []))]);
  const missing: string[] = [];
  for (const id of ids) {
    const blob = await loadImage(id).catch(() => null);
    if (blob) zip.file(`images/${id}.jpg`, blob);
    else missing.push(id);
  }
  data.missing_images = missing;
  zip.file("data.json", JSON.stringify(data, null, 2));
  return { blob: await zip.generateAsync({ type: "blob" }), missing: missing.length };
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
