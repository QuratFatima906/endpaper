"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Logo, TextField } from "@/components/ui";
import { sendMagicLink, signInWithGoogle, useSession } from "@/lib/session";
import { cloudEnabled } from "@/lib/supabase";

export default function Welcome() {
  const { ready, user } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signed in already: RequireAuth on /library sends new accounts on to /username.
  useEffect(() => {
    if (ready && user) router.replace("/library");
  }, [ready, user, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const clean = email.trim();
      await sendMagicLink(clean);
      if (cloudEnabled) router.push(`/check-email?email=${encodeURIComponent(clean)}`);
    } catch (err) {
      setError((err as Error).message || "Couldn't send the link. Are you online?");
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError((err as Error).message || "Couldn't reach Google. Are you online?");
    }
  }

  return (
    <main className="relative z-[1] mx-auto grid min-h-dvh max-w-[1280px] md:grid-cols-[1.1fr_1fr]">
      <div className="flex flex-col items-start gap-[22px] px-7 pt-[max(120px,22dvh)] md:justify-center md:gap-[26px] md:p-20">
        <Logo size={44} word={false} className="md:hidden" />
        <Logo size={52} word={false} className="hidden md:inline-flex" />
        <h1 className="font-serif text-[46px] leading-none tracking-[-0.02em] md:text-[72px]">endpaper</h1>
        <p className="max-w-[460px] font-serif text-[21px] leading-[1.35] italic text-pretty md:text-[30px] md:leading-[1.3]">
          A memory lane for the books that stayed with you.
        </p>
      </div>

      <div className="flex items-end px-7 pb-[calc(env(safe-area-inset-bottom)+44px)] md:items-center md:justify-center md:border-l md:border-rule-soft md:p-0">
        <form onSubmit={submit} className="flex w-full flex-col gap-[14px] md:w-[360px]">
          <h2 className="mb-2 hidden font-serif text-[26px] md:block">Sign in or create an account</h2>
          <TextField
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
          />
          <Button type="submit" disabled={busy || !email.trim()} className="md:h-12 md:rounded-3xl">
            {busy ? "Sending…" : cloudEnabled ? "Send me a sign-in link" : "Start on this device"}
          </Button>
          {cloudEnabled && (
            <>
              <p className="text-center text-[13px] text-muted">or</p>
              <Button variant="outline" onClick={google} className="md:h-12">
                Continue with Google
              </Button>
            </>
          )}
          <nav aria-label="Legal" className="mt-[10px] flex justify-center gap-[18px] text-[13px] text-muted md:mt-[14px]">
            <Link href="/privacy" className="min-h-11 content-center hover:text-ink">
              Privacy
            </Link>
            <Link href="/terms" className="min-h-11 content-center hover:text-ink">
              Terms
            </Link>
          </nav>
        </form>
      </div>
    </main>
  );
}
