"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AccountFrame } from "@/components/account-frame";
import { UsernameField, useUsernameCheck } from "@/components/account-username";
import { Button } from "@/components/ui";
import { createProfile, useSession } from "@/lib/session";

export default function PickUsername() {
  const { ready, user, profile } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const check = useUsernameCheck(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/");
    else if (profile?.username) router.replace("/library");
  }, [ready, user, profile, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user || check.state !== "ok") return;
    setBusy(true);
    try {
      await createProfile(user, name);
      router.replace("/library");
    } catch (err) {
      setError((err as Error).message || "Couldn't save that. Try again?");
      setBusy(false);
    }
  }

  if (!ready || !user) return null;
  return (
    <AccountFrame>
      <form onSubmit={submit} className="flex flex-1 flex-col">
        <h1 className="mt-[max(40px,13dvh)] font-serif text-4xl leading-[1.1] md:mt-[80px] md:text-[44px]">Pick a username</h1>
        <p className="mt-[14px] text-[15px] leading-[1.55] text-muted text-pretty">
          It&apos;s the address of your public page, if you ever make one. Everything stays private until then. You can change it later.
        </p>
        <UsernameField value={name} onChange={setName} check={check} className="mt-8" autoFocus />
        {error && (
          <p role="alert" className="mt-2 text-[13px] text-accent">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || check.state !== "ok"} className="mt-auto md:mt-6 md:h-12 md:self-start md:rounded-3xl">
          {busy ? "Saving…" : "Continue"}
        </Button>
      </form>
    </AccountFrame>
  );
}
