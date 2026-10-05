"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { AppHeader, BottomAction, ButtonLink, Cover, Empty, Page, Rule, Tabs, TippedPhoto, cx } from "@/components/ui";
import { db } from "@/lib/db";
import { STATUSES, visibilityLabel } from "@/lib/marks";
import type { Status } from "@/lib/types";

export default function LibraryPage() {
  return (
    <Suspense>
      <Library />
    </Suspense>
  );
}

const EMPTY_TAB: Record<Status, string> = {
  reading: "Nothing on the go. Add what you're reading now.",
  shelf: "Nothing waiting. Add books you own but haven't started, so you don't forget them.",
  finished: "No finished books yet.",
  set_aside: "Nothing set aside.",
};

function Library() {
  const router = useRouter();
  const params = useSearchParams();
  const status = (STATUSES.find((s) => s.id === params.get("status"))?.id ?? "reading") as Status;

  const books = useLiveQuery(() => db.books.orderBy("updated_at").reverse().filter((b) => !b.deleted_at).toArray(), []);
  const inbox = useLiveQuery(() => db.passages.orderBy("created_at").reverse().filter((p) => !p.deleted_at && (p.book_id === null || p.mark === null)).toArray(), []);

  if (!books) return null;
  const shown = books.filter((b) => b.status === status);
  const toSort = inbox?.length ?? 0;

  if (books.length === 0)
    return (
      <Page>
        <AppHeader active="library" />
        <h1 className="mt-10 font-serif text-[38px] leading-none md:mt-[34px] md:text-[44px]">Library</h1>
        <section className="relative mt-[120px] flex h-[230px] flex-col items-center justify-center gap-[10px] px-[30px] text-center md:mt-10 md:h-[360px] md:gap-3">
          <span aria-hidden="true" className="rough absolute inset-0 rounded-md border-[1.5px] border-dashed border-field md:rounded-lg" />
          <h2 className="relative font-serif text-2xl leading-[1.2] italic md:text-[32px]">An empty shelf</h2>
          <p className="relative max-w-[380px] text-sm leading-[1.5] text-muted md:text-[15px]">Add the book you&apos;re reading now. Your first passage takes about ten seconds.</p>
          <div className="relative mt-4 hidden items-center gap-[18px] md:flex">
            <ButtonLink href="/add" size="md">Add a book</ButtonLink>
            <GoodreadsLink />
          </div>
        </section>
        <BottomAction>
          <div className="flex flex-col items-center gap-[18px] [&>a:first-child]:w-full">
            <ButtonLink href="/add">Add a book</ButtonLink>
            <GoodreadsLink />
          </div>
        </BottomAction>
      </Page>
    );

  return (
    <Page>
      <AppHeader active="library" />
      <div className="md:grid md:grid-cols-[1fr_280px] md:gap-14 md:pt-[34px]">
        <div className="flex flex-col">
          <div className="mt-10 flex items-baseline justify-between md:mt-0 md:items-end">
            <h1 className="font-serif text-[38px] leading-none md:text-[44px]">Library</h1>
            <Link href="/add" className="min-h-11 content-center text-sm text-accent md:hidden">
              + Add
            </Link>
            <div className="hidden gap-[10px] md:flex">
              <ButtonLink href="/add" variant="outline" size="md">Add a book</ButtonLink>
              <ButtonLink href="/capture" size="md">Capture a passage</ButtonLink>
            </div>
          </div>
          <Tabs
            label="Reading status"
            className="mt-[22px]"
            tabs={STATUSES.map((s) => ({ label: s.label, active: s.id === status, onClick: () => router.replace(s.id === "reading" ? "/library" : `/library?status=${s.id}`, { scroll: false }) }))}
          />
          <div key={status} className="page-in mt-7 md:mt-[30px]">
            {shown.length === 0 ? (
              <Empty>{EMPTY_TAB[status]}</Empty>
            ) : (
              <ul className="grid grid-cols-3 gap-x-4 gap-y-[26px] md:grid-cols-5 md:gap-x-6 md:gap-y-[30px]">
                {shown.map((b) => (
                  <li key={b.id}>
                    <Link href={`/book?id=${b.id}`} className="press flex flex-col gap-[6px]">
                      <Cover book={b} className="md:p-3" />
                      {b.cover_url && <span className="sr-only">{b.title}</span>}
                      <span className="text-xs leading-[1.3] text-muted md:text-[13px]">{b.author}</span>
                      <span className={cx("text-[11px] md:text-xs", b.visibility === "public" ? "text-accent" : "text-muted")}>{visibilityLabel(b.visibility)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {toSort > 0 && (
          <aside aria-label="Inbox" className="mt-10 md:mt-0">
            <Rule soft className="md:hidden" />
            <Link href="/inbox" className="mt-[14px] flex min-h-11 items-baseline justify-between md:mt-0">
              <span className="font-serif text-base md:text-xl">Inbox</span>
              <span className="font-hand text-[17px] text-accent">{toSort} to sort</span>
            </Link>
            <div className="hidden flex-col gap-[18px] md:mt-[18px] md:flex">
              {inbox!.slice(0, 2).map((p, i) =>
                p.image_id ? (
                  <TippedPhoto key={p.id} imageId={p.image_id} alt={p.alt || p.text || "Passage photo"} rotate={i ? 1 : -1.2} height={110} />
                ) : (
                  <p key={p.id} className="line-clamp-4 font-serif text-base leading-[1.4]">
                    {p.text || "A passage with no text yet"}
                  </p>
                ),
              )}
              <Link href="/inbox" className="min-h-11 content-center text-sm font-medium text-accent">
                Sort them →
              </Link>
            </div>
          </aside>
        )}
      </div>
      <BottomAction>
        <ButtonLink href="/capture">Capture a passage</ButtonLink>
      </BottomAction>
    </Page>
  );
}

function GoodreadsLink() {
  return (
    <Link href="/settings/import" className="min-h-11 content-center text-sm underline underline-offset-[3px]">
      Import from Goodreads
    </Link>
  );
}
