"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { BackLink, Empty, Page } from "@/components/ui";
import { PassageEditor } from "@/components/book-passage-editor";

function PassageScreen() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const p = useLiveQuery(async () => (id ? ((await db.passages.get(id)) ?? null) : null), [id]);
  const book = useLiveQuery(async () => (p?.book_id ? ((await db.books.get(p.book_id)) ?? null) : null), [p?.book_id]);
  const back = p?.book_id && book && !book.deleted_at ? { href: `/book?id=${p.book_id}`, label: book.title } : { href: "/inbox", label: "Inbox" };

  if (p === undefined) return <Page>{null}</Page>;
  if (!p || p.deleted_at)
    return (
      <Page>
        <div className="pt-[calc(env(safe-area-inset-top)+18px)]">
          <BackLink href="/library">Library</BackLink>
        </div>
        <h1 className="mt-6 font-serif text-[32px]">Passage not found</h1>
        <div className="mt-3">
          <Empty>It may have been deleted, or it hasn&apos;t synced to this device yet.</Empty>
        </div>
      </Page>
    );

  return (
    <Page className="md:max-w-[720px]">
      <div className="flex items-center justify-between pt-[calc(env(safe-area-inset-top)+18px)] md:pt-[30px]">
        <BackLink href={back.href}>{back.label}</BackLink>
        <Link href={back.href} className="min-h-11 content-center text-sm text-accent">
          Done
        </Link>
      </div>
      <h1 className="sr-only">Passage{p.page ? `, page ${p.page}` : ""}</h1>
      <div className="mt-4">
        <PassageEditor key={p.id} passage={p} onDeleted={() => router.replace(back.href)} />
      </div>
    </Page>
  );
}

export default function PassagePage() {
  return (
    <Suspense>
      <PassageScreen />
    </Suspense>
  );
}
