"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AccountFrame } from "@/components/account-frame";
import { BackLink, Button } from "@/components/ui";
import { sendMagicLink } from "@/lib/session";

const COOLDOWN = 30;

function CheckEmail() {
  const email = useSearchParams().get("email") ?? "";
  const [wait, setWait] = useState(COOLDOWN); // the first link was just sent
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function resend() {
    setNote(null);
    setWait(COOLDOWN);
    try {
      await sendMagicLink(email);
      setNote("Sent another link.");
    } catch (err) {
      setNote((err as Error).message || "Couldn't send the link. Are you online?");
    }
  }

  return (
    <AccountFrame>
      <div className="md:hidden">
        <BackLink href="/">Back</BackLink>
      </div>
      <div className="mt-[max(40px,14dvh)] flex flex-col md:mt-0">
        <h1 className="font-serif text-4xl leading-[1.1] md:text-[44px]">Check your inbox</h1>
        <p className="mt-4 font-serif text-[17px] leading-normal text-pretty md:text-[19px]">
          We sent a sign-in link to {email ? <span className="font-medium break-all">{email}</span> : "your email"}. Open it on this device to continue.
        </p>
        <p className="mt-[14px] text-sm text-muted">The link works once. If it doesn&apos;t arrive, check spam.</p>
        <p role="status" className="mt-3 min-h-5 text-sm text-muted">
          {note}
        </p>
      </div>
      <div className="mt-auto flex flex-col items-center gap-[18px] md:mt-6 md:flex-row md:gap-4">
        <Button variant="outline" onClick={resend} disabled={!email || wait > 0} className="self-stretch md:h-12 md:self-auto">
          {wait > 0 ? `Send again in ${wait}s` : "Send again"}
        </Button>
        <Link href="/" className="min-h-11 content-center text-sm underline underline-offset-[3px]">
          Use a different email
        </Link>
      </div>
    </AccountFrame>
  );
}

export default function Page() {
  return (
    <Suspense>
      <CheckEmail />
    </Suspense>
  );
}
