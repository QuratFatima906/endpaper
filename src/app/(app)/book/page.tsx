"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { db } from "@/lib/db";
import { STATUSES, statusLabel, visibilityLabel } from "@/lib/marks";
import { deleteBook, isMark, now, patch } from "@/lib/repo";
import type { Book, Status } from "@/lib/types";
import { AppHeader, BackLink, Button, ButtonLink, Chip, Empty, Page, Sheet, Tabs, TextField } from "@/components/ui";
import { BookPassages } from "@/components/book-passages";
import { BookWords } from "@/components/book-words";
import { BookPages } from "@/components/book-pages";
import { BookReflection } from "@/components/book-reflection";
import { CheckinSheet } from "@/components/checkin-sheet";
import { useDraft } from "@/components/book-draft";

const TABS = [
  { id: "passages", label: "Passages" },
  { id: "words", label: "Words" },
  { id: "pages", label: "Pages" },
  { id: "reflection", label: "Reflection" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function EditFields({ book }: { book: Book }) {
  const [title, setTitle] = useDraft(book.title, (v) => v.trim() && patch<Book>("books", book.id, { title: v.trim() }));
  const [author, setAuthor] = useDraft(book.author, (v) => patch<Book>("books", book.id, { author: v.trim() }));
  return (
    <>
      <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <TextField label="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
    </>
  );
}

function BookMenu({ book, open, onClose, onCheckin }: { book: Book; open: boolean; onClose: () => void; onCheckin: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"menu" | "edit" | "delete">("menu");
  const close = () => {
    setMode("menu");
    onClose();
  };
  const item = "min-h-11 py-2 text-left text-base";
  return (
    <Sheet open={open} onClose={close} title={book.title}>
      {mode === "menu" && (
        <>
          <h2 className="font-serif text-[28px] leading-[1.1]">{book.title}</h2>
          <div className="flex flex-col">
            <button type="button" className={item} onClick={() => {
                close();
                onCheckin();
              }}>
              Log a reading session
            </button>
            <button type="button" className={item} onClick={() => setMode("edit")}>
              Edit title and author
            </button>
            <button type="button" className={item} onClick={() => setMode("delete")}>
              Delete book
            </button>
          </div>
        </>
      )}
      {mode === "edit" && (
        <>
          <h2 className="font-serif text-[28px] leading-[1.1]">Edit book</h2>
          <EditFields book={book} />
          <Button variant="outline" onClick={close}>
            Done
          </Button>
        </>
      )}
      {mode === "delete" && (
        <>
          <h2 className="font-serif text-[28px] leading-[1.1]">Delete this book?</h2>
          <p className="text-muted">Its passages and photos go with it. This can&apos;t be undone.</p>
          <div className="flex flex-col gap-3 md:flex-row-reverse">
            <Button
              onClick={async () => {
                await deleteBook(book.id);
                close();
                router.replace("/library");
              }}
            >
              Delete book
            </Button>
            <Button variant="outline" onClick={close}>
              Keep it
            </Button>
          </div>
        </>
      )}
    </Sheet>
  );
}

function BookScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id") ?? "";
  const tab: TabId = TABS.find((t) => t.id === params.get("tab"))?.id ?? "passages";
  const markParam = params.get("mark");
  const mark = isMark(markParam) ? markParam : null;
  const book = useLiveQuery(async () => (id ? ((await db.books.get(id)) ?? null) : null), [id]);
  const [menu, setMenu] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [checkin, setCheckin] = useState(false);

  const href = (t: TabId, m?: string | null) => `/book?id=${id}${t === "passages" ? "" : `&tab=${t}`}${m ? `&mark=${m}` : ""}`;

  if (book === undefined) return <Page>{null}</Page>;
  if (!book || book.deleted_at)
    return (
      <Page>
        <div className="hidden md:block">
          <AppHeader active="library" />
        </div>
        <div className="pt-[calc(env(safe-area-inset-top)+18px)] md:pt-[30px]">
          <BackLink href="/library">Library</BackLink>
        </div>
        <h1 className="mt-6 font-serif text-[32px]">Book not found</h1>
        <div className="mt-3">
          <Empty>It may have been deleted, or it hasn&apos;t synced to this device yet.</Empty>
        </div>
      </Page>
    );

  async function setStatus(s: Status) {
    await patch<Book>("books", id, { status: s, finished_at: s === "finished" ? (book?.finished_at ?? now()) : null });
    setStatusOpen(false);
  }

  const moreBtn = (
    <button type="button" onClick={() => setMenu(true)} aria-label="Book options" aria-haspopup="dialog" className="flex min-h-11 min-w-11 items-center justify-center text-ink">
      <svg width="20" height="4" viewBox="0 0 20 4" aria-hidden="true">
        <circle cx="2" cy="2" r="1.8" fill="currentColor" />
        <circle cx="10" cy="2" r="1.8" fill="currentColor" />
        <circle cx="18" cy="2" r="1.8" fill="currentColor" />
      </svg>
    </button>
  );

  return (
    <Page>
      <div className="hidden md:block">
        <AppHeader active="library" />
      </div>
      <div className="flex items-center justify-between pt-[calc(env(safe-area-inset-top)+18px)] md:pt-[30px]">
        <BackLink href="/library">Library</BackLink>
        <div className="flex items-center gap-2 md:hidden">
          <Link href={`/share?id=${id}`} className="min-h-11 content-center px-1 text-sm">
            Share
          </Link>
          {moreBtn}
        </div>
      </div>
      <div className="md:flex md:items-end md:justify-between md:gap-8">
        <div>
          <h1 className="mt-[14px] font-serif text-4xl leading-none text-pretty md:mt-2 md:text-[44px]">{book.title}</h1>
          <p className="mt-2 text-[13px] text-muted md:text-sm">
            {book.author && <>{book.author} · </>}
            <button type="button" onClick={() => setStatusOpen(true)} aria-haspopup="dialog" className="-my-3 min-h-11 py-3 underline decoration-rule underline-offset-4 hover:text-ink">
              {statusLabel(book.status)}
              <span className="sr-only">, change status</span>
            </button>
            {" · "}
            {visibilityLabel(book.visibility)}
          </p>
        </div>
        <div className="hidden flex-none items-center gap-[10px] md:flex">
          {moreBtn}
          <ButtonLink href={`/share?id=${id}`} variant="outline" size="md">
            Share
          </ButtonLink>
          <ButtonLink href={`/capture?book=${id}`} size="md">
            Capture a passage
          </ButtonLink>
        </div>
      </div>

      <Tabs label="Book sections" className="mt-[22px] md:mt-5" tabs={TABS.map((t) => ({ label: t.label, href: href(t.id), active: tab === t.id }))} />

      <div key={tab} className="page-in">
        {tab === "passages" && <BookPassages bookId={id} bookTitle={book.title} mark={mark} onFilter={(m) => router.replace(href("passages", m), { scroll: false })} />}
        {tab === "words" && <BookWords bookId={id} />}
        {tab === "pages" && <BookPages bookId={id} />}
        {tab === "reflection" && <BookReflection bookId={id} />}
      </div>

      <Sheet open={statusOpen} onClose={() => setStatusOpen(false)} title="Reading status">
        <h2 className="font-serif text-[28px] leading-[1.1]">Status</h2>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <Chip key={s.id} selected={book.status === s.id} onClick={() => setStatus(s.id)}>
              {s.label}
            </Chip>
          ))}
        </div>
      </Sheet>
      <BookMenu book={book} open={menu} onClose={() => setMenu(false)} onCheckin={() => setCheckin(true)} />
      <CheckinSheet bookId={id} open={checkin} onClose={() => setCheckin(false)} />
    </Page>
  );
}

export default function BookPage() {
  return (
    <Suspense>
      <BookScreen />
    </Suspense>
  );
}
