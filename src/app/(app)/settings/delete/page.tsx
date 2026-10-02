"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AppHeader, BackLink, Button, TextField } from "@/components/ui";
import { clearLocal } from "@/lib/db";
import { useSession } from "@/lib/session";
import { cloudEnabled, supabase } from "@/lib/supabase";

export default function DeleteAccount() {
  const { profile } = useSession();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!profile) return null; // RequireAuth guarantees it
  const matches = typed === profile.username;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!matches) return;
    setBusy(true);
    setError(null);
    let emailed = false;
    if (cloudEnabled) {
      try {
        const { data } = await supabase().auth.getSession();
        const res = await fetch("/api/account/delete", { method: "POST", headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Something went wrong. Nothing was deleted.");
        emailed = !!body.emailed;
        await supabase().auth.signOut({ scope: "local" }).catch(() => {});
      } catch (err) {
        setError(navigator.onLine ? (err as Error).message : "You're offline. Connect to delete your account.");
        setBusy(false);
        return;
      }
    }
    await clearLocal(); // this device's copy (and, device-only, the local account itself)
    window.location.assign(emailed ? "/goodbye?emailed=1" : "/goodbye");
  }

  return (
    <main className="relative z-[1] mx-auto w-full max-w-[720px] px-6 md:max-w-[1280px] md:px-10">
      <div className="hidden md:block">
        <AppHeader />
      </div>
      <form onSubmit={submit} className="mx-auto flex min-h-dvh max-w-[560px] flex-col pb-[calc(env(safe-area-inset-bottom)+40px)] md:min-h-0">
        <div className="pt-[calc(env(safe-area-inset-top)+50px)] md:pt-[40px]">
          <BackLink href="/settings">Settings</BackLink>
        </div>
        <h1 className="mt-[26px] font-serif text-[32px] leading-[1.1] md:mt-4 md:text-[40px]">Delete your account</h1>
        <p className="mt-3 text-[15px] leading-[1.55] text-pretty">
          This permanently removes your books, passages, photos, notes and reflections. Anything you&apos;ve published comes down immediately. It can&apos;t be undone.
        </p>

        <Link href="/settings/export" className="press relative mt-[22px] flex items-center justify-between px-[18px] py-4">
          <span aria-hidden="true" className="rough pointer-events-none absolute inset-0 rounded-xl border-[1.5px] border-dashed border-faint" />
          <span className="relative flex flex-col gap-[2px]">
            <span className="font-serif text-[17px]">Download a backup first</span>
            <span className="text-xs text-muted">Recommended</span>
          </span>
          <span className="relative text-sm font-medium text-accent">Export</span>
        </Link>

        <div className="mt-[30px]">
          <TextField
            label={`Type ${profile.username} to confirm`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            error={error}
          />
        </div>

        <div className="mt-auto flex flex-col items-center gap-[18px] pt-10 md:mt-8 md:flex-row md:pt-0">
          <Button type="submit" disabled={!matches || busy} className="w-full bg-ink! text-paper! md:h-12 md:w-auto md:rounded-3xl">
            {busy ? "Deleting…" : "Delete everything"}
          </Button>
          <Link href="/settings" className="min-h-11 content-center text-sm">
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
