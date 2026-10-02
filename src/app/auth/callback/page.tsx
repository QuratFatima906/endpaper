"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountFrame } from "@/components/account-frame";
import { useSession } from "@/lib/session";

// supabase-js (PKCE + detectSessionInUrl) exchanges the ?code= on its own when the
// client starts; this page only waits for the session and moves on.
export default function AuthCallback() {
  const { ready, user } = useSession();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Errors arrive in the query (PKCE) or the hash (implicit / some providers).
    const q = new URLSearchParams(window.location.search);
    const h = new URLSearchParams(window.location.hash.slice(1));
    const msg = q.get("error_description") ?? h.get("error_description") ?? q.get("error") ?? h.get("error");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL once on arrival
    if (msg) return setError(msg.replace(/\+/g, " "));
    const t = setTimeout(() => setError("That link didn't work. It may have expired or already been used."), 15_000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (ready && user) router.replace("/library"); // RequireAuth sends first-timers to /username
  }, [ready, user, router]);

  return (
    <AccountFrame>
      <div className="mt-[max(40px,20dvh)] flex flex-col gap-4 md:mt-0">
        {error ? (
          <>
            <h1 className="font-serif text-4xl leading-[1.1]">Couldn&apos;t sign you in</h1>
            <p className="text-[15px] leading-[1.55] text-muted">{error}</p>
            <Link href="/" className="min-h-11 content-center self-start text-sm underline underline-offset-[3px]">
              Get a new link
            </Link>
          </>
        ) : (
          <p role="status" className="font-serif text-lg italic text-muted">
            Signing you in…
          </p>
        )}
      </div>
    </AccountFrame>
  );
}
