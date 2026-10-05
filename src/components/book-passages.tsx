"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db } from "@/lib/db";
import { ALL_HINT, MARKS } from "@/lib/marks";
import type { Mark } from "@/lib/types";
import { BottomAction, ButtonLink, Chip, Empty, MarginNote, MarkGlyph, RoughBorder, TippedPhoto } from "@/components/ui";
import { cx } from "@/lib/cx";
import { PassageEditor } from "@/components/book-passage-editor";
import { Portal } from "@/components/book-draft";

const FILTERS = MARKS.filter((m) => m.id !== "glossary");
const pageNum = (p: string) => parseFloat(p) || Infinity;

export function BookPassages({ bookId, bookTitle, mark, onFilter }: { bookId: string; bookTitle: string; mark: Mark | null; onFilter: (m: Mark | null) => void }) {
  const all = useLiveQuery(() => db.passages.where("book_id").equals(bookId).filter((p) => !p.deleted_at).reverse().sortBy("created_at"), [bookId]);
  const [sel, setSel] = useState<string | null>(null);
  if (!all) return null;
  const list = mark ? all.filter((p) => p.mark === mark) : all;
  const current = list.find((p) => p.id === sel) ?? list[0];

  return (
    <>
      <div role="group" aria-label="Filter passages" className="mt-4 flex flex-wrap gap-2 md:mt-[22px]">
        <Chip selected={!mark} onClick={() => onFilter(null)} tip={ALL_HINT} className="px-[14px] text-[13px]">
          All
        </Chip>
        {FILTERS.map((m) => (
          <Chip key={m.id} selected={mark === m.id} onClick={() => onFilter(mark === m.id ? null : m.id)} aria-label={m.id === "key" ? undefined : m.name} tip={m.hint} className="px-[14px] text-[13px]">
            {m.id === "key" ? `${m.glyph} Key points` : m.glyph}
          </Chip>
        ))}
      </div>

      {mark === "key" ? (
        <section aria-labelledby="key-h" className="mt-7 md:mt-[34px]">
          <h2 id="key-h" className="font-serif text-[28px] leading-none">
            Key points
          </h2>
          <p className="mt-2 text-[13px] text-muted">{bookTitle} · everything you marked ✱</p>
          {list.length === 0 ? (
            <div className="mt-6">
              <Empty>Nothing marked ✱ yet.</Empty>
            </div>
          ) : (
            <ol className="mt-[30px] flex max-w-[760px] flex-col gap-[22px] md:gap-[26px]">
              {[...list]
                .sort((a, b) => pageNum(a.page) - pageNum(b.page) || a.created_at.localeCompare(b.created_at))
                .map((p, i) => (
                  <li key={p.id} className="flex gap-[14px] md:gap-[18px]">
                    <span className="min-w-[18px] font-serif text-xl leading-[1.4] text-accent italic md:text-2xl" aria-hidden="true">
                      {i + 1}
                    </span>
                    <Link href={`/passage?id=${p.id}`} className="flex flex-col gap-1">
                      <p className="font-serif text-[19px] leading-[1.4] md:text-[22px]">{p.text || p.note || "Untitled passage"}</p>
                      <span className="text-xs text-muted">{[!p.text && p.note ? "your note" : "", p.page ? `p. ${p.page}` : ""].filter(Boolean).join(" · ")}</span>
                    </Link>
                  </li>
                ))}
            </ol>
          )}
        </section>
      ) : list.length === 0 ? (
        <div className="mt-8">
          <Empty>{mark ? "No passages with this mark yet." : "No passages yet. Capture one when a line stops you."}</Empty>
        </div>
      ) : (
        <>
          <h2 className="sr-only">Passages</h2>
          {/* Phone: the scrapbook list. Each passage opens its own page. */}
          <ul className="md:hidden">
            {list.map((p, i) => (
              <li key={p.id} className="mt-7">
                <Link href={`/passage?id=${p.id}`} className="block">
                  {p.image_id && <TippedPhoto imageId={p.image_id} alt={p.alt || p.text || "Photo of the passage"} rotate={i % 2 ? 1.2 : -1.4} className="mb-5" />}
                  <div className="flex items-baseline gap-3">
                    <MarkGlyph mark={p.mark} />
                    {p.page && <span className="text-xs text-muted">p. {p.page}</span>}
                  </div>
                  <p className="mt-2 font-serif text-xl leading-[1.4] text-pretty">{p.text || <span className="text-muted italic">No text yet</span>}</p>
                </Link>
                {p.note && <MarginNote className="mt-2">{p.note}</MarginNote>}
              </li>
            ))}
          </ul>

          {/* Desktop: list on the left, the selected passage open beside it. */}
          <div className="mt-[14px] hidden gap-14 md:grid md:grid-cols-[400px_1fr]">
            <ul className="flex flex-col gap-[6px]">
              {list.map((p) => {
                const on = p.id === current?.id;
                return (
                  <li key={p.id}>
                    <button type="button" aria-pressed={on} onClick={() => setSel(p.id)} className="relative flex w-full flex-col gap-[6px] px-4 py-[14px] text-left">
                      {on && <RoughBorder radius={10} color="var(--accent)" width={2} fill="var(--accent-wash)" />}
                      <span className="relative flex items-baseline gap-[10px]">
                        <MarkGlyph mark={p.mark} className="text-lg" />
                        {p.page && <span className="text-xs text-muted">p. {p.page}</span>}
                      </span>
                      <span className={cx("relative line-clamp-4 font-serif text-[17px] leading-[1.4]", !p.text && "text-muted italic")}>{p.text || "No text yet"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {current && <PassageEditor key={current.id} passage={current} side onDeleted={() => setSel(null)} />}
          </div>
        </>
      )}

      <Portal>
        <BottomAction>
        <ButtonLink href={`/capture?book=${bookId}`}>Capture a passage</ButtonLink>
      </BottomAction>
      </Portal>
    </>
  );
}
