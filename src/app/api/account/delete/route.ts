import { NextResponse } from "next/server";
import { IMAGE_BUCKET, supabaseAdmin } from "@/lib/supabase";

// R-AUTH-6: delete the account and everything in it. Rows cascade from auth.users;
// photos live in storage and have to be removed by hand.
export async function POST(req: Request) {
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Account deletion isn't set up on this server yet. Nothing was deleted." }, { status: 503 });

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const { id: uid, email } = data.user;

  // Images are stored flat at `${uid}/${imageId}`.
  const bucket = admin.storage.from(IMAGE_BUCKET);
  for (;;) {
    const { data: objects, error: listErr } = await bucket.list(uid, { limit: 1000 });
    if (listErr) return failed("list images", listErr);
    if (!objects?.length) break;
    const { data: removed, error: rmErr } = await bucket.remove(objects.map((o) => `${uid}/${o.name}`));
    if (rmErr) return failed("remove images", rmErr);
    if (!removed?.length) break; // nothing more we can remove; don't spin
  }

  // Anonymous count only (no id, no email) so we can report how many accounts were deleted.
  const { error: logErr } = await admin.from("deletion_log").insert({ deleted_on: new Date().toISOString().slice(0, 10) });
  if (logErr) console.error("deletion_log insert failed", logErr);

  const { error: delErr } = await admin.auth.admin.deleteUser(uid);
  if (delErr) return failed("delete user", delErr);

  let emailed = false;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (key && from && email) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [email],
          subject: "Your Endpaper account has been deleted",
          text: "Your Endpaper account and everything in it, including your photos and any public pages, has been permanently deleted.\n\nIf you didn't ask for this, reply to this email.\n\nThanks for reading with us.",
        }),
      });
      emailed = res.ok;
      if (!res.ok) console.error("deletion email failed", res.status, await res.text());
    } catch (err) {
      console.error("deletion email failed", err);
    }
  }

  return NextResponse.json({ ok: true, emailed });
}

function failed(step: string, err: unknown) {
  console.error(`account delete: ${step}`, err);
  return NextResponse.json({ error: "Something went wrong deleting your account. Please try again." }, { status: 500 });
}
