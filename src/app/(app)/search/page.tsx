"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { findMatch } from "@/components/library-text";
import { AppHeader, Chip, Empty, Eyebrow, Page, Rule, RoughBorder } from "@/components/ui";
import { db } from "@/lib/db";
import { STATUSES, VERDICTS } from "@/lib/marks";
import type { Book } from "@/lib/types";

export default function SearchPage() {
  return (
    <Suspense>
      <Search />
    </Suspense>
  );
}

const yearOf = (b: Book) => new Date(b.finished_at ?? b.started_at ?? b.created_at).getFullYear();

/** Text with the first match of q highlighted; long text is windowed around the match. */
function Hl({ text, q, max = 260 }: { text: string; q: string; max?: number }) {
  const m = findMatch(text, q);
  if (!m) return <>{text.length > max ? text.slice(0, max) + "…" : text}</>;
  const from = text.length > max ? Math.max(0, m[0] - 80) : 0;
  const to = Math.min(text.length, from + max);
  return (
    <>
      {from > 0 && "…"}
      {text.slice(from, m[0])}
      <mark className="bg-accent-wash text-inherit">{text.slice(m[0], m[1])}</mark>
      {text.slice(m[1], to)}
      {to < text.length && "…"}
    </>
  );
}

function Search() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const status = params.get("status");
  const year = params.get("year");
  const verdict = params.get("verdict");
  const filtered = !!(status || year || verdict);

  // Next syncs useSearchParams with native history calls, without a navigation.
  const setParam = (changes: Record<string, string | null>) => {
    const p = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(changes)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    window.history.replaceState(null, "", p.size ? `?${p}` : window.location.pathname);
  };

  // ponytail: in-memory scan of every row per keystroke; fine for a personal library (thousands of rows).
  // Move to a prebuilt token index (or Postgres full-text on the server) if it ever stutters.
  const data = useLiveQuery(async () => {
    const alive = <T extends { deleted_at: string | null }>(r: T) => !r.deleted_at;
    const [books, passages, words, reflections] = await Promise.all([
      db.books.filter(alive).toArray(),
      db.passages.filter(alive).toArray(),
      db.words.filter(alive).toArray(),
      db.reflections.filter(alive).toArray(),
    ]);
    return { books, passages, words, reflections };
  }, []);

  const query = q.trim();
  const ready = query.length >= 2;
  const results = (() => {
    // No query + "All" lists every book, same as picking any single filter.
    if (!data) return null;
    const byId = new Map(data.books.map((b) => [b.id, b]));
    const verdictOf = new Map(data.reflections.map((r) => [r.book_id, r.verdict]));
    const ok = (id: string | null) => {
      if (!filtered) return true;
      const b = id ? byId.get(id) : undefined;
      return !!b && (!status || b.status === status) && (!year || String(yearOf(b)) === year) && (!verdict || verdictOf.get(b.id) === verdict);
    };
    const hit = (...s: string[]) => !ready || s.some((x) => findMatch(x, query));
    return {
      books: data.books.filter((b) => ok(b.id) && hit(b.title, b.author)),
      passages: ready ? data.passages.filter((p) => ok(p.book_id) && hit(p.text, p.note)) : [],
      words: ready ? data.words.filter((w) => ok(w.book_id) && hit(w.word, w.definition)) : [],
      reflections: ready ? data.reflections.filter((r) => ok(r.book_id) && hit(r.takeaway, r.understood, r.unsure, r.recommend)) : [],
      title: (id: string | null) => (id && byId.get(id)?.title) || "No book yet",
    };
  })();
  const total = results ? results.books.length + results.passages.length + results.words.length + results.reflections.length : 0;
  const years = data ? [...new Set(data.books.map(yearOf))].sort((a, b) => b - a) : [];

  const chip = (key: string, value: string, label: string, current: string | null) => (
    <Chip key={value} className="flex-none text-[13px]" selected={current === value} onClick={() => setParam({ [key]: current === value ? null : value })}>
      {label}
    </Chip>
  );

  return (
    <Page>
      <div className="hidden md:block">
        <AppHeader active="search" />
      </div>
      <div className="md:grid md:grid-cols-[240px_1fr] md:gap-14 md:pt-[34px]">
        <div className="flex items-center gap-[14px] pt-[calc(env(safe-area-inset-top)+14px)] md:col-start-2 md:row-start-1 md:max-w-[700px] md:pt-0">
          <div className="relative flex-1">
            <RoughBorder radius={28} />
            <input
              type="search"
              aria-label="Search passages, notes, words and books"
              placeholder="Search your library"
              autoFocus
              enterKeyHint="search"
              value={q}
              onChange={(e) => (setQ(e.target.value), setParam({ q: e.target.value || null }))}
              className="relative h-[46px] w-full bg-transparent px-4 font-serif text-[17px] outline-none placeholder:text-faint md:h-14 md:px-5 md:text-[22px]"
            />
          </div>
          <Link href="/library" className="min-h-11 content-center text-sm md:hidden">
            Cancel
          </Link>
        </div>

        <div role="group" aria-label="Filters" className="-mx-6 mt-[22px] flex gap-2 overflow-x-auto px-6 md:col-start-1 md:row-span-2 md:row-start-1 md:mx-0 md:mt-0 md:flex-col md:gap-[22px] md:overflow-visible md:px-0">
          <div className="contents md:flex md:flex-col md:gap-[22px]">
            <Eyebrow className="hidden md:block">Status</Eyebrow>
            <div className="contents md:flex md:flex-wrap md:gap-2">
              <Chip className="flex-none text-[13px]" selected={!filtered} onClick={() => setParam({ status: null, year: null, verdict: null })}>
                All
              </Chip>
              {STATUSES.map((s) => chip("status", s.id, s.label, status))}
            </div>
          </div>
          {years.length > 0 && (
            <div className="contents md:flex md:flex-col md:gap-[22px]">
              <Eyebrow className="hidden md:block">Year</Eyebrow>
              <div className="contents md:flex md:flex-wrap md:gap-2">{years.map((y) => chip("year", String(y), String(y), year))}</div>
            </div>
          )}
          <div className="contents md:flex md:flex-col md:gap-[22px]">
            <Eyebrow className="hidden md:block">Verdict</Eyebrow>
            <div className="contents md:flex md:flex-wrap md:gap-2">{VERDICTS.map((v) => chip("verdict", v.id, v.label, verdict))}</div>
          </div>
        </div>

        <div aria-live="polite" className="mt-[26px] flex flex-col gap-8 md:col-start-2 md:row-start-2 md:mt-[18px] md:max-w-[700px]">
          {results && total === 0 && <Empty>{ready || filtered ? `Nothing matches${ready ? ` “${query}”` : ""}.` : "No books yet."}</Empty>}
          {results && (
            <>
              <Group label="Books" count={results.books.length}>
                {results.books.map((b) => (
                  <Item key={b.id} href={`/book?id=${b.id}`} meta={b.author}>
                    <span className="font-serif text-lg leading-[1.4] md:text-[21px]">
                      <Hl text={b.title} q={query} />
                    </span>
                  </Item>
                ))}
              </Group>
              <Group label="Passages" count={results.passages.length}>
                {results.passages.map((p) => {
                  const inNote = !findMatch(p.text, query) && !!findMatch(p.note, query);
                  return (
                    <Item key={p.id} href={`/passage?id=${p.id}`} meta={[results.title(p.book_id), inNote ? "your note" : p.page && `p. ${p.page}`].filter(Boolean).join(" · ")}>
                      {inNote ? (
                        <span className="font-hand text-[17px] leading-[1.35] text-accent md:text-[19px]">
                          <Hl text={p.note} q={query} />
                        </span>
                      ) : (
                        <span className="font-serif text-lg leading-[1.4] md:text-[21px]">
                          “<Hl text={p.text} q={query} />”
                        </span>
                      )}
                    </Item>
                  );
                })}
              </Group>
              <Group label="Words" count={results.words.length}>
                {results.words.map((w) => (
                  <Item key={w.id} href={`/book?id=${w.book_id}&tab=words`} meta={results.title(w.book_id)}>
                    <span className="font-serif text-lg leading-[1.4] md:text-[21px]">
                      <Hl text={w.word} q={query} />
                    </span>
                    {w.definition && (
                      <span className="block text-sm leading-[1.5] text-muted">
                        <Hl text={w.definition} q={query} max={160} />
                      </span>
                    )}
                  </Item>
                ))}
              </Group>
              <Group label="Reflections" count={results.reflections.length}>
                {results.reflections.map((r) => {
                  const text = [r.takeaway, r.understood, r.unsure, r.recommend].find((x) => findMatch(x, query)) ?? r.takeaway;
                  return (
                    <Item key={r.id} href={`/book?id=${r.book_id}&tab=reflection`} meta={`${results.title(r.book_id)} · your reflection`}>
                      <span className="font-serif text-lg leading-[1.4] md:text-[21px]">
                        <Hl text={text} q={query} />
                      </span>
                    </Item>
                  );
                })}
              </Group>
            </>
          )}
        </div>
      </div>
    </Page>
  );
}

function Group({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  if (!count) return null;
  return (
    <section className="flex flex-col gap-[14px]">
      <h2 className="text-[13px] text-muted">
        {label} · {count}
      </h2>
      <ul className="flex flex-col gap-[14px]">{children}</ul>
    </section>
  );
}

function Item({ href, meta, children }: { href: string; meta: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-[14px] [&:first-child>svg]:hidden">
      <Rule soft />
      <Link href={href} className="flex flex-col gap-[6px] py-1">
        <span className="text-xs text-muted">{meta}</span>
        {children}
      </Link>
    </li>
  );
}
