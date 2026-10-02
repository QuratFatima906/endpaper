"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { LinkBox } from "@/components/share-link";
import { BackLink, Button, ButtonLink, Empty, Page, RoughBorder, SavedHint, Sheet } from "@/components/ui";
import { db } from "@/lib/db";
import { now, patch, saveEssay } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { cloudEnabled } from "@/lib/supabase";
import { useSyncState } from "@/lib/sync";
import type { Book, Essay, Reflection, Visibility } from "@/lib/types";

export default function EssayPage() {
  return (
    <Suspense>
      <EssayLoader />
    </Suspense>
  );
}

function EssayLoader() {
  const id = useSearchParams().get("id") ?? "";
  const data = useLiveQuery(async () => {
    const [book, essay, reflection] = await Promise.all([db.books.get(id), db.essays.get(id), db.reflections.get(id)]);
    return { book: book && !book.deleted_at ? book : null, essay: essay && !essay.deleted_at ? essay : null, reflection: reflection && !reflection.deleted_at ? reflection : null };
  }, [id]);
  if (!data) return null;
  if (!data.book)
    return (
      <Page className="pt-16">
        <Empty>This book isn’t here.</Empty>
      </Page>
    );
  return <EssayEditor key={data.book.id} book={data.book} essay={data.essay} reflection={data.reflection} />;
}

/** First draft comes from the reflection, one paragraph per answered prompt. */
const seed = (r: Reflection | null) => (r ? [r.takeaway, r.understood, r.unsure, r.recommend].map((s) => s.trim()).filter(Boolean).join("\n\n") : "");

function EssayEditor({ book, essay, reflection }: { book: Book; essay: Essay | null; reflection: Reflection | null }) {
  const { profile } = useSession();
  const offline = useSyncState().status === "offline";
  const [title, setTitle] = useState(essay?.title ?? "");
  const [body, setBody] = useState(essay?.body ?? seed(reflection));
  const [sheet, setSheet] = useState<"none" | "visibility" | "published" | "unpublish">("none");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const published = !!essay?.published_at;
  const url = `${typeof location === "undefined" ? "" : location.origin}/@${profile?.username}/${book.slug}/essay`;

  useEffect(() => () => clearTimeout(timer.current), []);
  function edit(changes: { title?: string; body?: string }) {
    if (changes.title !== undefined) setTitle(changes.title);
    if (changes.body !== undefined) setBody(changes.body);
    clearTimeout(timer.current);
    const next = { title, body, ...changes };
    timer.current = setTimeout(() => void saveEssay(book.id, next), 400);
  }

  async function publish(vis?: Visibility) {
    clearTimeout(timer.current);
    if (vis) await patch<Book>("books", book.id, { visibility: vis });
    await saveEssay(book.id, { title, body, published_at: now() });
    setSheet("published");
  }
  async function unpublish() {
    await saveEssay(book.id, { published_at: null }); // R-PUB-9: the link dies on next sync
    setSheet("none");
  }

  const canPublish = cloudEnabled && !!profile?.username && !!body.trim();
  const actions = (
    <>
      <ButtonLink variant="outline" size="md" href={`/preview?id=${book.id}&view=essay`} className="flex-1 md:flex-none">
        Preview
      </ButtonLink>
      {published ? (
        <Button variant="outline" size="md" onClick={() => setSheet("unpublish")} className="flex-1 md:flex-none">
          Unpublish
        </Button>
      ) : (
        <Button size="md" disabled={!canPublish} onClick={() => (book.visibility === "private" ? setSheet("visibility") : publish())} className="flex-1 md:flex-none">
          Publish…
        </Button>
      )}
    </>
  );

  return (
    <Page className="md:max-w-[1280px]">
      <div className="flex items-center justify-between gap-3 pt-[calc(env(safe-area-inset-top)+18px)] md:pt-[22px]">
        <BackLink href={`/book?id=${book.id}`}>{book.title}</BackLink>
        <div className="flex items-center gap-[10px]">
          <span className="relative px-[10px] py-1 text-xs text-muted md:px-3">
            <span aria-hidden="true" className="rough absolute inset-0 rounded-xl border-[1.5px] border-dashed border-faint" />
            <span className="relative">{published ? "Published" : "Draft"}</span>
          </span>
          <span className="hidden md:inline">
            <SavedHint at={essay?.updated_at} />
          </span>
          <div className="hidden gap-[10px] md:flex">{actions}</div>
        </div>
      </div>

      <article className="mx-auto mt-[26px] flex max-w-[680px] flex-col md:mt-[60px]">
        <label htmlFor="essay-title" className="sr-only">
          Essay title
        </label>
        <textarea
          id="essay-title"
          rows={1}
          value={title}
          onChange={(e) => edit({ title: e.target.value.replace(/\n/g, " ") })}
          placeholder="Give it a title"
          className="block w-full resize-none bg-transparent font-serif text-[32px] leading-[1.15] outline-none [field-sizing:content] [text-wrap:pretty] md:text-[52px] md:leading-[1.1]"
        />
        <p className="mt-2 text-[13px] text-muted md:mt-[10px] md:text-sm">
          {book.title}
          {book.author && ` · ${book.author}`}
        </p>
        <label htmlFor="essay-body" className="sr-only">
          Essay. Leave a blank line between paragraphs.
        </label>
        <textarea
          id="essay-body"
          value={body}
          onChange={(e) => edit({ body: e.target.value })}
          placeholder="Start writing. A blank line starts a new paragraph."
          className="mt-[22px] block min-h-[40vh] w-full resize-none bg-transparent font-serif text-[17px] leading-[1.6] outline-none [field-sizing:content] md:mt-[26px] md:text-xl md:leading-[1.65]"
        />
        <p className="mt-4 md:hidden">
          <SavedHint at={essay?.updated_at} />
        </p>
        {!cloudEnabled && <p className="mt-4 text-[13px] text-muted">Publishing needs cloud sync to be set up.</p>}
      </article>

      <div className="no-print fixed inset-x-6 bottom-[calc(env(safe-area-inset-bottom)+24px)] z-10 flex gap-[10px] md:hidden">{actions}</div>

      <Sheet open={sheet === "visibility"} onClose={() => setSheet("none")} title="Share the book first">
        <h2 className="m-0 font-serif text-[26px] leading-[1.15] font-normal">Share the book first?</h2>
        <p className="text-[15px] leading-[1.55] text-muted">
          <cite className="font-serif not-italic">{book.title}</cite> is private. An essay is read on the book’s page, so choose who can find it. Only what you’ve switched on in Share is shown alongside it.
        </p>
        <Button onClick={() => publish("unlisted")}>Unlisted: anyone with the link</Button>
        <Button variant="outline" onClick={() => publish("public")}>
          Public: on your profile
        </Button>
        <Button variant="quiet" onClick={() => setSheet("none")}>
          Keep it private
        </Button>
      </Sheet>

      <Sheet open={sheet === "published"} onClose={() => setSheet("none")} title="Published">
        <div className="relative -rotate-4 self-start px-[22px] py-[14px] text-accent">
          <RoughBorder radius={6} color="var(--accent)" width={2.2} />
          <span className="relative text-[15px] font-medium tracking-[.2em]">PUBLISHED</span>
        </div>
        <h2 className="m-0 font-serif text-[30px] leading-[1.15] font-normal md:text-[32px]">{title || "Untitled"}</h2>
        <p className="text-[15px] leading-[1.55] text-muted">
          {book.visibility === "public" ? "It’s on your profile now." : "Anyone with the link can read it."} You can unpublish at any time, and it disappears straight away.
          {offline && " Takes effect once you’re online."}
        </p>
        <LinkBox url={url} />
        <ButtonLink href={url.replace(/^https?:\/\/[^/]+/, "")}>View essay</ButtonLink>
        <button type="button" onClick={() => setSheet("unpublish")} className="min-h-11 text-sm underline">
          Unpublish
        </button>
      </Sheet>

      <Sheet open={sheet === "unpublish"} onClose={() => setSheet("none")} title="Take this essay down?">
        <h2 className="m-0 font-serif text-[26px] leading-[1.15] font-normal md:text-[28px]">Take this essay down?</h2>
        <p className="text-[15px] leading-[1.55] text-muted">
          The link will stop working for everyone right away. Your draft stays here, private, and you can publish it again later.
          {offline && " Takes effect once you’re online."}
        </p>
        <div className="flex flex-col gap-[14px] md:flex-row-reverse md:gap-[10px]">
          <button type="button" onClick={unpublish} className="press h-[54px] rounded-[27px] bg-ink px-7 text-[15px] font-medium text-paper md:h-12">
            Unpublish
          </button>
          <Button variant="outline" onClick={() => setSheet("none")} className="md:h-12">
            Keep it up
          </Button>
        </div>
      </Sheet>
    </Page>
  );
}
