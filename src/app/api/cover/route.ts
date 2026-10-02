import { NextResponse } from "next/server";

// Same-origin copy of a book cover, so "Save as image" can draw it (Google Books sends no CORS headers).
// Locked to the cover hosts we actually use; anything else is refused (no open proxy).
const HOSTS = ["covers.openlibrary.org", "archive.org", "books.google.com", "books.googleusercontent.com"];
const allowed = (u: URL) => u.protocol === "https:" && HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));

export async function GET(req: Request) {
  let target: URL;
  try {
    target = new URL(new URL(req.url).searchParams.get("u") ?? "");
  } catch {
    return new NextResponse("Bad URL", { status: 400 });
  }
  if (!allowed(target)) return new NextResponse("Host not allowed", { status: 403 });

  // Follow at most 3 redirects by hand, re-checking every hop, so a redirect can never
  // point the server at a host outside the allowlist (SSRF).
  let res: Response | null = null;
  for (let hop = 0; hop <= 3; hop++) {
    res = await fetch(target, { redirect: "manual" }).catch(() => null);
    const location = res && res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!location) break;
    target = new URL(location, target);
    if (!allowed(target)) return new NextResponse("Redirect not allowed", { status: 403 });
    res = null;
  }
  if (!res?.ok) return new NextResponse("Not found", { status: 404 });
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) return new NextResponse("Not an image", { status: 415 });
  const body = await res.arrayBuffer();
  if (body.byteLength > 5_000_000) return new NextResponse("Too large", { status: 413 });
  return new NextResponse(body, { headers: { "Content-Type": type, "Cache-Control": "public, max-age=604800, immutable" } });
}
