"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { LinkBox } from "@/components/share-link";
import { Button, ButtonLink, Empty, Eyebrow, Page, RoughBorder, cx } from "@/components/ui";
import { db } from "@/lib/db";
import { VISIBILITY } from "@/lib/marks";
import { patch } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { cloudEnabled } from "@/lib/supabase";
import { useSyncState } from "@/lib/sync";
import type { Book, ShareSections, Visibility } from "@/lib/types";

const SECTIONS: { id: keyof ShareSections; label: string; hint?: string }[] = [
  { id: "reflection", label: "Reflection" },
  { id: "passages", label: "Passages", hint: "Short quotes only; photos stay private" },
  { id: "words", label: "Words" },
  { id: "pages", label: "Pages" },
  { id: "mood", label: "Mood line" },
];

export default function SharePage() {
  return (
    <Suspense>
      <Share />
    </Suspense>
  );
}

function Share() {
  const id = useSearchParams().get("id") ?? "";
  const book = useLiveQuery(async () => (await db.books.get(id)) ?? null, [id]);
  if (book === undefined) return null;
  if (!book || book.deleted_at)
    return (
      <Page className="pt-16">
        <Empty>This book isn’t here.</Empty>
      </Page>
    );
  return <ShareForm key={book.id} book={book} />;
}

function ShareForm({ book }: { book: Book }) {
  const { profile } = useSession();
  const sync = useSyncState();
  // Everything stays private until "Share" is pressed; once the book is shared,
  // changes apply straight away, and going Private always applies straight away (R-PUB-9).
  const live = book.visibility !== "private";
  const [vis, setVis] = useState<Visibility>(book.visibility);
  const [share, setShare] = useState<ShareSections>(book.share);
  const [link, setLink] = useState<string | null>(null);
  const url = `${typeof location === "undefined" ? "" : location.origin}/@${profile?.username}/${book.slug}`;

  function chooseVis(v: Visibility) {
    setVis(v);
    if (v === "private") setLink(null);
    if (v === "private" || live) void patch<Book>("books", book.id, { visibility: v });
  }
  function toggle(k: keyof ShareSections) {
    const next = { ...share, [k]: !share[k] };
    setShare(next);
    if (live) void patch<Book>("books", book.id, { share: next });
  }
  async function doShare() {
    await patch<Book>("books", book.id, { visibility: vis, share });
    setLink(url);
    if (navigator.share) await navigator.share({ title: book.title, url }).catch(() => {});
  }

  return (
    <Page className="flex min-h-dvh flex-col md:max-w-[520px]">
      <div className="flex items-center justify-between pt-[calc(env(safe-area-inset-top)+18px)] md:pt-9">
        <Link href={`/book?id=${book.id}`} className="inline-flex min-h-11 w-16 items-center text-sm">
          Close
        </Link>
        <h1 className="m-0 truncate font-serif text-[17px] font-normal md:text-[28px]">Share {book.title}</h1>
        <span className="w-16" />
      </div>

      <fieldset className="mt-[30px] flex flex-col gap-[10px] border-0 p-0">
        <legend className="mb-3 p-0">
          <Eyebrow>Who can see it</Eyebrow>
        </legend>
        {VISIBILITY.map((v) => {
          const on = vis === v.id;
          return (
            <label key={v.id} className="press relative flex cursor-pointer flex-col gap-[3px] rounded-xl px-4 py-[14px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
              <input type="radio" name="visibility" value={v.id} checked={on} onChange={() => chooseVis(v.id)} className="sr-only" />
              <RoughBorder radius={12} color={on ? "var(--accent)" : "var(--field)"} width={on ? 2 : 1.5} fill={on ? "var(--accent-wash)" : undefined} />
              <span className={cx("relative font-serif text-[17px] md:text-lg", on && "text-accent")}>{v.label}</span>
              <span className={cx("relative text-[13px]", on ? "text-ink" : "text-muted")}>{v.hint}</span>
            </label>
          );
        })}
      </fieldset>
      {sync.status === "offline" && <p className="mt-3 text-[13px] text-muted" role="status">Takes effect once you’re online.</p>}

      <div className="mt-7">
        <Eyebrow>What’s included</Eyebrow>
        <div className="mt-[6px] flex flex-col">
          {SECTIONS.map((s) => (
            <button key={s.id} type="button" role="switch" aria-checked={share[s.id]} onClick={() => toggle(s.id)} className="flex min-h-12 items-center justify-between gap-4 py-[11px] text-left">
              <span className="flex flex-col gap-[2px]">
                <span className="text-[15px]">{s.label}</span>
                {s.hint && <span className="text-xs text-muted">{s.hint}</span>}
              </span>
              <span aria-hidden="true" className="relative h-[26px] w-11 flex-none">
                {share[s.id] ? <span className="absolute inset-0 rounded-[13px] bg-accent" /> : <RoughBorder radius={13} />}
                <span className={cx("absolute top-1 size-[18px] rounded-full transition-[left] duration-150", share[s.id] ? "left-[22px] bg-on-accent" : "left-1 bg-field")} />
              </span>
            </button>
          ))}
        </div>
      </div>

      {link && (
        <div className="mt-7 flex flex-col gap-2">
          <p className="text-[13px] text-muted">{vis === "public" ? "On your profile now." : "Anyone with this link can see it."}</p>
          <LinkBox url={link} />
        </div>
      )}
      {!cloudEnabled && <p className="mt-7 text-[13px] text-muted">Links start working once cloud sync is set up for this app.</p>}

      <div className="mt-auto flex gap-[10px] pt-10 pb-[calc(env(safe-area-inset-bottom)+40px)] md:pb-9">
        <ButtonLink variant="outline" href={`/preview?id=${book.id}`} className="flex-1 md:h-12">
          <span className="md:hidden">Preview</span>
          <span className="hidden md:inline">Preview as a visitor</span>
        </ButtonLink>
        <Button onClick={doShare} disabled={vis === "private" || !profile?.username} className="flex-1 md:h-12">
          Share
        </Button>
      </div>
    </Page>
  );
}

