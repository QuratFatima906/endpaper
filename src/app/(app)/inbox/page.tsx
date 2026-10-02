"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { AppHeader, BackLink, Button, ButtonLink, Chip, Empty, Eyebrow, Page, RoughBorder, Sheet, TippedPhoto, cx, useTooltip } from "@/components/ui";
import { db } from "@/lib/db";
import { MARKS } from "@/lib/marks";
import { updatePassage } from "@/lib/repo";
import { useSyncState } from "@/lib/sync";
import type { Mark, Passage } from "@/lib/types";

const DAY = 86_400_000;
function when(iso: string) {
  const d = new Date(iso);
  const midnight = new Date().setHours(0, 0, 0, 0);
  if (d.getTime() >= midnight) return "Today";
  if (d.getTime() >= midnight - DAY) return "Yesterday";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

const ROTATE = [-1.2, 1, -0.6];

export default function Inbox() {
  const items = useLiveQuery(() => db.passages.orderBy("created_at").reverse().filter((p) => !p.deleted_at && (p.book_id === null || p.mark === null)).toArray(), []);
  const books = useLiveQuery(() => db.books.orderBy("updated_at").reverse().filter((b) => !b.deleted_at).toArray(), []);
  const sync = useSyncState();
  const [sorting, setSorting] = useState<Passage | null>(null);
  const titleOf = (id: string | null) => books?.find((b) => b.id === id)?.title;

  return (
    <Page>
      <div className="hidden md:block">
        <AppHeader active="inbox" />
      </div>
      <div className="pt-[calc(env(safe-area-inset-top)+18px)] md:hidden">
        <BackLink href="/library">Library</BackLink>
      </div>
      <h1 className="mt-[26px] font-serif text-[36px] leading-none md:mt-[34px] md:text-[44px]">Inbox</h1>
      <p className="mt-[10px] text-sm leading-[1.5] text-muted md:text-[15px]">Passages you saved in a hurry. Give each a book and a mark when you have a minute.</p>

      {items && items.length === 0 && (
        <div className="mt-10">
          <Empty>Nothing to sort. Every passage has a book and a mark.</Empty>
        </div>
      )}

      <ul className="mt-7 grid gap-[30px] md:mt-10 md:grid-cols-3 md:gap-12">
        {items?.map((p, i) => {
          const title = titleOf(p.book_id);
          const waiting = p._dirty && sync.status !== "idle" && sync.status !== "local";
          const meta = [when(p.created_at), waiting && "saved offline · waiting to sync"].filter(Boolean).join(" · ");
          return (
            <li key={p.id} className="flex flex-col gap-[14px]">
              {p.image_id ? (
                <TippedPhoto imageId={p.image_id} alt={p.alt || p.text || "Passage photo"} rotate={ROTATE[i % 3]} height={140} />
              ) : (
                <blockquote className="line-clamp-6 font-serif text-lg leading-[1.4]">{p.text || "A passage with no text yet"}</blockquote>
              )}
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="text-muted">
                  {meta}
                  <span className="md:hidden"> · {title ?? "No book yet"}</span>
                </span>
                <button type="button" onClick={() => setSorting(p)} className="min-h-11 font-medium text-accent">
                  <span className="md:hidden">Sort</span>
                  <span className="hidden md:inline">{title ? `${title} ›` : "Choose a book ›"}</span>
                </button>
              </div>
              <div role="group" aria-label="Mark" className="hidden grid-cols-5 gap-2 md:grid">
                {MARKS.map((m) => (
                  <MarkButton key={m.id} mark={m.id} selected={p.mark === m.id} onClick={() => updatePassage(p.id, { mark: p.mark === m.id ? null : m.id })} />
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      {sorting && <SortSheet key={sorting.id} passage={sorting} books={books ?? []} onClose={() => setSorting(null)} />}
    </Page>
  );
}

function MarkButton({ mark, selected, onClick }: { mark: Mark; selected: boolean; onClick: () => void }) {
  const m = MARKS.find((x) => x.id === mark)!;
  const { trigger, bubble } = useTooltip(m.hint);
  return (
    <span className="relative grid">
      <button type="button" aria-label={m.spoken} aria-pressed={selected} onClick={onClick} className={cx("press relative flex h-[50px] items-center justify-center font-serif text-2xl", selected && "text-accent", mark === "glossary" && "italic")} {...trigger}>
        <RoughBorder radius={10} color={selected ? "var(--accent)" : "var(--field)"} width={selected ? 2 : 1.5} fill={selected ? "var(--accent-wash)" : undefined} />
        <span className="relative" aria-hidden="true">
          {m.glyph}
        </span>
      </button>
      {bubble}
    </span>
  );
}

function SortSheet({ passage, books, onClose }: { passage: Passage; books: { id: string; title: string; author: string }[]; onClose: () => void }) {
  const [bookId, setBookId] = useState(passage.book_id);
  const [mark, setMark] = useState(passage.mark);
  const save = async () => {
    await updatePassage(passage.id, { book_id: bookId, mark });
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title="Sort this passage">
      <h2 className="font-serif text-2xl">Sort this passage</h2>
      <section className="flex flex-col gap-3">
        <Eyebrow>Book</Eyebrow>
        {books.length === 0 ? (
          <ButtonLink href="/add" variant="outline" size="md" className="self-start">
            Add a book
          </ButtonLink>
        ) : (
          <ul role="group" aria-label="Book" className="-mx-2 flex max-h-[40vh] flex-col overflow-y-auto">
            {books.map((b) => (
              <li key={b.id}>
                <button type="button" aria-pressed={bookId === b.id} onClick={() => setBookId(b.id)} className={cx("flex min-h-11 w-full items-baseline gap-2 rounded-lg px-2 py-2 text-left", bookId === b.id && "bg-accent-wash text-accent")}>
                  <span className="font-serif text-lg">{b.title}</span>
                  <span className="truncate text-[13px] text-muted">{b.author}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <Eyebrow>Mark</Eyebrow>
        <div role="group" aria-label="Mark" className="flex flex-wrap gap-2">
          {MARKS.map((m) => (
            <Chip key={m.id} selected={mark === m.id} onClick={() => setMark(mark === m.id ? null : m.id)} aria-label={m.spoken} tip={m.hint}>
              <span aria-hidden="true">
                <span className={cx("font-serif", m.id === "glossary" && "italic")}>{m.glyph}</span> {m.name}
              </span>
            </Chip>
          ))}
        </div>
      </section>
      <Button onClick={save}>Save</Button>
    </Sheet>
  );
}
