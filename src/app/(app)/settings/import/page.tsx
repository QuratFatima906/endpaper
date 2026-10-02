"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { AppHeader, BackLink, Button, ButtonLink, cx, Page, Rule } from "@/components/ui";
import { db } from "@/lib/db";
import { checkedByDefault, isDuplicate, parseGoodreads, statusFor, type GoodreadsBook } from "@/lib/goodreads";
import { addBook } from "@/lib/repo";

type Opts = { dates: boolean; ratings: boolean; reviews: boolean };

function Check({ checked, onChange, disabled, children }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; children: ReactNode }) {
  return (
    <label className={cx("flex min-h-11 items-center gap-[14px] py-2", disabled ? "text-muted" : "cursor-pointer")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="size-5 flex-none accent-[var(--accent)]" />
      {children}
    </label>
  );
}

export default function GoodreadsImport() {
  const existing = useLiveQuery(() => db.books.filter((b) => !b.deleted_at).toArray(), []);
  const [books, setBooks] = useState<GoodreadsBook[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [opts, setOpts] = useState<Opts>({ dates: true, ratings: false, reviews: true });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const dupes = useMemo(() => new Set((books ?? []).filter((b) => existing && isDuplicate(b, existing)).map((b) => b.key)), [books, existing]);
  const selectable = (books ?? []).filter((b) => !dupes.has(b.key));
  const chosen = selectable.filter((b) => picked.has(b.key));
  const reviews = (books ?? []).filter((b) => b.review).length;

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setDone(null);
    try {
      const parsed = parseGoodreads(await file.text());
      if (!parsed.length) throw new Error("No books found in that file.");
      setBooks(parsed);
      setPicked(new Set(parsed.filter(checkedByDefault).map((b) => b.key)));
    } catch (err) {
      setBooks(null);
      setError((err as Error).message);
    }
  }

  const toggle = (key: number, on: boolean) =>
    setPicked((s) => {
      const n = new Set(s);
      if (on) n.add(key);
      else n.delete(key);
      return n;
    });

  async function run() {
    setBusy(true);
    for (const b of chosen) {
      await addBook({
        title: b.title,
        author: b.author,
        isbn: b.isbn,
        status: statusFor(b.shelf),
        ...(b.shelf === "currently-reading" ? {} : { started_at: null }),
        finished_at: opts.dates ? b.dateRead : null,
        source: "goodreads",
        visibility: "private",
        goodreads_rating: opts.ratings ? b.rating : null,
        goodreads_review: opts.reviews ? b.review : null,
      });
    }
    setDone(chosen.length);
    setBooks(null);
    setBusy(false);
  }

  return (
    <Page>
      <div className="hidden md:block">
        <AppHeader />
      </div>
      <div className="mx-auto max-w-[640px]">
        <div className="pt-[calc(env(safe-area-inset-top)+50px)] md:pt-[40px]">
          <BackLink href="/settings">Settings</BackLink>
        </div>
        <h1 className="mt-[26px] font-serif text-[32px] leading-[1.1] md:mt-4 md:text-[40px]">From your Goodreads file</h1>

        {done !== null ? (
          <div className="mt-[10px] flex flex-col gap-6">
            <p role="status" className="text-[15px] leading-normal text-muted">
              {done === 0 ? "Nothing new to bring in." : `${done} ${done === 1 ? "book is" : "books are"} in your library now, all private.`}
            </p>
            <ButtonLink href="/library" variant="outline" className="md:h-12 md:self-start">
              Go to your library
            </ButtonLink>
          </div>
        ) : !books ? (
          <div className="mt-[10px] flex flex-col gap-6">
            <p className="text-sm leading-normal text-muted md:text-[15px]">
              On Goodreads, go to My Books → Import and export → Export library, then choose the file here. Everything comes in private.
            </p>
            <label className="press relative inline-flex h-[54px] cursor-pointer items-center justify-center rounded-[27px] bg-accent px-7 text-[15px] font-medium text-on-accent focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent md:h-12 md:self-start">
              Choose your export (.csv)
              <input type="file" accept=".csv,text/csv" onChange={onFile} className="sr-only" />
            </label>
            {error && (
              <p role="alert" className="text-sm text-accent">
                {error}
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="mt-[10px] text-sm leading-normal text-muted md:text-[15px]">
              {books.length} {books.length === 1 ? "book" : "books"} found.
              {dupes.size > 0 && ` ${dupes.size} ${dupes.size === 1 ? "is" : "are"} already here and will be skipped.`} Everything comes in private.
            </p>

            <fieldset className="mt-[22px]">
              <legend className="text-[13px] text-muted">Bring in</legend>
              <div className="mt-2 grid md:grid-cols-2 md:gap-x-[30px]">
                <Check checked={opts.dates} onChange={(v) => setOpts({ ...opts, dates: v })}>
                  <span className="font-serif text-[17px]">Dates read</span>
                </Check>
                <Check checked={opts.ratings} onChange={(v) => setOpts({ ...opts, ratings: v })}>
                  <span className="flex flex-col">
                    <span className="font-serif text-[17px]">Star ratings</span>
                    <span className="text-xs text-muted">kept as a note; Endpaper uses verdicts</span>
                  </span>
                </Check>
                <Check checked={opts.reviews} onChange={(v) => setOpts({ ...opts, reviews: v })}>
                  <span className="flex flex-col">
                    <span className="font-serif text-[17px]">Your review text</span>
                    <span className="text-xs text-muted">
                      {reviews} {reviews === 1 ? "review" : "reviews"}, kept with each book
                    </span>
                  </span>
                </Check>
              </div>
            </fieldset>

            <Rule soft className="mt-2" />

            <div className="mt-[14px]">
              <div className="flex items-center justify-between text-[13px]">
                <h2 className="text-muted">Books</h2>
                <span className="flex gap-4">
                  <button type="button" className="min-h-11 text-accent" onClick={() => setPicked(new Set(selectable.map((b) => b.key)))}>
                    Select all
                  </button>
                  <button type="button" className="min-h-11 text-accent" onClick={() => setPicked(new Set())}>
                    None
                  </button>
                </span>
              </div>
              <ul className="flex flex-col">
                {books.map((b) => {
                  const dupe = dupes.has(b.key);
                  return (
                    <li key={b.key}>
                      <Check checked={!dupe && picked.has(b.key)} disabled={dupe} onChange={(v) => toggle(b.key, v)}>
                        <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                          <span className="min-w-0">
                            <span className="font-serif text-base">{b.title}</span>
                            {b.author && <span className="text-[13px] text-muted"> · {b.author}</span>}
                          </span>
                          <span className="flex-none text-sm text-muted">
                            {dupe ? "already in your library" : b.shelf === "read" && b.year ? `read · ${b.year}` : b.shelf}
                          </span>
                        </span>
                      </Check>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+24px)] mt-6 flex md:static">
              <Button onClick={run} disabled={busy || !chosen.length} className="w-full md:h-12 md:w-auto md:rounded-3xl">
                {busy ? "Importing…" : `Import ${chosen.length} ${chosen.length === 1 ? "book" : "books"}`}
              </Button>
            </div>
          </>
        )}
      </div>
    </Page>
  );
}
