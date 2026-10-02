import { supabaseServer } from "@/lib/supabase";

// R-PUB-13: anyone can report public content. Insert-only table; read with the service role.
// ponytail: no rate limit; add one (IP bucket in the proxy or Vercel firewall) if reports get spammed.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { url?: unknown; reason?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!/^https?:\/\//.test(url) || url.length >= 500 || reason.length >= 2000) {
    return Response.json({ error: "Invalid report" }, { status: 400 });
  }
  const sb = supabaseServer();
  if (!sb) return Response.json({ error: "Reports need cloud sync configured" }, { status: 503 });
  const { error } = await sb.from("reports").insert({ url, reason });
  if (error) return Response.json({ error: "Couldn't save report" }, { status: 500 });
  return new Response(null, { status: 204 });
}
