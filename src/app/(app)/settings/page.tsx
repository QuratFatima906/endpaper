"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AppHeader, BackLink, Button, Chip, Eyebrow, Page, Rule, Sheet } from "@/components/ui";
import { cx } from "@/lib/cx";
import { patch } from "@/lib/repo";
import { signOut, useSession } from "@/lib/session";
import { cloudEnabled } from "@/lib/supabase";
import { useSyncState } from "@/lib/sync";
import type { Profile } from "@/lib/types";

const THEMES: { id: Profile["theme"]; label: string }[] = [
  { id: "system", label: "Match device" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];
const SIZES: { id: Profile["text_size"]; label: string; px: number }[] = [
  { id: "s", label: "Small text", px: 13 },
  { id: "m", label: "Medium text", px: 19 },
  { id: "l", label: "Large text", px: 24 },
];

const rowCls = "flex min-h-12 w-full items-center justify-between gap-4 py-3 text-left text-[15px] md:py-[14px]";

function Row({ href, label, value, onClick }: { href?: string; label: string; value?: ReactNode; onClick?: () => void }) {
  const inner = (
    <>
      <span>{label}</span>
      <span className="text-muted">
        {value} <span aria-hidden="true">›</span>
      </span>
    </>
  );
  return href ? (
    <Link href={href} className={cx(rowCls, "hover:text-accent")}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cx(rowCls, "hover:text-accent")}>
      {inner}
    </button>
  );
}

function Section({ id, title, children, last }: { id: string; title: string; children: ReactNode; last?: boolean }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="mt-[18px] scroll-mt-6 first:mt-0 md:mt-[26px]">
      <Eyebrow>
        <h2 id={`${id}-h`}>{title}</h2>
      </Eyebrow>
      <div className="mt-1 flex flex-col">{children}</div>
      {!last && <Rule soft className="mt-[6px] md:hidden" />}
    </section>
  );
}

export default function Settings() {
  const { user, profile } = useSession();
  const sync = useSyncState();
  const [sheet, setSheet] = useState<null | "theme" | "signout">(null);
  const [leaving, setLeaving] = useState(false);
  if (!profile || !user) return null; // RequireAuth guarantees both
  const set = (changes: Partial<Profile>) => patch<Profile>("profiles", profile.id, changes);
  const themeLabel = THEMES.find((t) => t.id === profile.theme)?.label ?? "Match device";

  async function leave(everywhere: boolean) {
    setLeaving(true);
    await signOut(everywhere).catch(() => setLeaving(false));
  }

  return (
    <Page>
      <div className="hidden md:block">
        <AppHeader />
      </div>
      <div className="pt-[calc(env(safe-area-inset-top)+50px)] md:hidden">
        <BackLink href="/library">Library</BackLink>
      </div>

      <div className="md:grid md:grid-cols-[220px_1fr] md:gap-20 md:pt-[34px]">
        <div className="md:sticky md:top-6 md:self-start">
          <h1 className="mt-[26px] font-serif text-4xl leading-none md:mt-0 md:text-[44px]">Settings</h1>
          <nav aria-label="Settings sections" className="mt-[30px] hidden flex-col gap-[14px] text-[15px] text-muted md:flex">
            <a href="#profile" className="hover:text-ink">Profile</a>
            <a href="#reading" className="hover:text-ink">Reading</a>
            <a href="#data" className="hover:text-ink">Your data</a>
            <a href="#account" className="hover:text-ink">Account</a>
          </nav>
        </div>

        <div className="mt-[26px] max-w-[620px] md:mt-0 md:pt-[70px]">
          <Section id="profile" title="Profile">
            <Row href="/settings/profile" label="Username" value={`@${profile.username}`} />
            <Row href="/settings/profile" label="Name and bio" value={profile.display_name || undefined} />
            <button type="button" role="switch" aria-checked={!profile.profile_hidden} onClick={() => set({ profile_hidden: !profile.profile_hidden })} className={rowCls}>
              <span>Public profile</span>
              <span aria-hidden="true" className={cx("relative h-[26px] w-11 flex-none rounded-[13px] transition-colors", profile.profile_hidden ? "bg-field" : "bg-accent")}>
                <span className={cx("absolute top-1 size-[18px] rounded-full bg-paper transition-[left]", profile.profile_hidden ? "left-1" : "left-[22px]")} />
              </span>
            </button>
            <p className="-mt-1 pb-2 text-[13px] text-muted">
              {profile.profile_hidden ? (
                "Your public page is hidden. Books you've shared can't be found through it."
              ) : (
                <>
                  Only books you choose to share appear on{" "}
                  <Link href={`/@${profile.username}`} className="underline underline-offset-[3px] hover:text-ink">
                    your public page
                  </Link>
                  .
                </>
              )}
            </p>
          </Section>

          <Section id="reading" title="Reading">
            <div className={rowCls}>
              <span id="size-l">Text size</span>
              <div role="radiogroup" aria-labelledby="size-l" className="flex items-baseline">
                {SIZES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={profile.text_size === s.id}
                    aria-label={s.label}
                    onClick={() => set({ text_size: s.id })}
                    className={cx("min-h-11 min-w-11 font-serif leading-none", profile.text_size === s.id ? "text-accent" : "text-muted hover:text-ink")}
                    style={{ fontSize: s.px }}
                  >
                    A
                  </button>
                ))}
              </div>
            </div>
            <Row label="Appearance" value={themeLabel} onClick={() => setSheet("theme")} />
          </Section>

          <Section id="data" title="Your data">
            <Row href="/settings/import" label="Import from Goodreads" />
            <Row href="/settings/export" label="Export everything" />
          </Section>

          <Section id="account" title="Account" last>
            <button type="button" onClick={() => setSheet("signout")} className={cx(rowCls, "hover:text-accent")}>
              Sign out
            </button>
            <Link href="/settings/delete" className={cx(rowCls, "text-muted hover:text-ink")}>
              Delete account
            </Link>
          </Section>

          <footer className="mt-10 flex flex-wrap items-center gap-x-[18px] text-xs text-muted">
            <Link href="/privacy" className="min-h-11 content-center hover:text-ink">Privacy</Link>
            <Link href="/terms" className="min-h-11 content-center hover:text-ink">Terms</Link>
            <span className="break-all">{user.email}</span>
          </footer>
        </div>
      </div>

      <Sheet open={sheet === "theme"} onClose={() => setSheet(null)} title="Appearance">
        <h2 className="font-serif text-[26px] leading-[1.15]">Appearance</h2>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <Chip key={t.id} selected={profile.theme === t.id} onClick={() => set({ theme: t.id })}>
              {t.label}
            </Chip>
          ))}
        </div>
        <Button variant="quiet" onClick={() => setSheet(null)}>
          Done
        </Button>
      </Sheet>

      <Sheet open={sheet === "signout"} onClose={() => setSheet(null)} title="Sign out">
        <div className="flex flex-col gap-[14px]">
          <h2 className="font-serif text-[26px] leading-[1.15]">Sign out?</h2>
          <p className="text-[15px] leading-[1.55] text-muted">
            {!cloudEnabled
              ? "Your library only lives on this device. Signing out erases it here for good. Export a backup first if you want to keep it."
              : sync.pending && sync.status === "offline"
                ? `You're offline and ${sync.pending} ${sync.pending === 1 ? "change hasn't" : "changes haven't"} synced yet. Signing out now would lose ${sync.pending === 1 ? "it" : "them"}. Connect first to keep ${sync.pending === 1 ? "it" : "them"}.`
                : "Captures waiting to sync on this device will upload first."}
          </p>
        </div>
        <div className="flex flex-col gap-[14px]">
          <Button onClick={() => leave(false)} disabled={leaving} className="bg-ink! text-paper!">
            {leaving ? "Signing out…" : "Sign out of this device"}
          </Button>
          {cloudEnabled && (
            <Button variant="outline" onClick={() => leave(true)} disabled={leaving}>
              Sign out everywhere
            </Button>
          )}
          <button type="button" onClick={() => setSheet(null)} className="min-h-11 text-sm">
            Cancel
          </button>
        </div>
      </Sheet>
    </Page>
  );
}
