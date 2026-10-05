"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { PublicBook, PublicEssay, type PublicBookData } from "@/components/public-book";
import { Button, Empty, Logo, Page, RoughDefs, Sheet } from "@/components/ui";
import { db } from "@/lib/db";
import { useSession } from "@/lib/session";
import { captureImage, saveImage } from "@/lib/share-image";

// R-PUB-6: what a visitor would see, built from LOCAL data with exactly the rules the
// server’s RLS applies: share toggles, hidden passages out, text only (never photos).

export default function PreviewPage() {
  return (
    <Suspense>
      <Preview />
    </Suspense>
  );
}

const live = <T extends { deleted_at: string | null }>(r: T) => !r.deleted_at;

function Preview() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const essayView = params.get("view") === "essay";
  const { profile } = useSession();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const shot = useRef<HTMLDivElement>(null);

  // Free the preview's object URL when it's replaced or the page goes away.
  useEffect(() => () => void (image && URL.revokeObjectURL(image.url)), [image]);

  const data = useLiveQuery(async () => {
    const book = await db.books.get(id);
    if (!book || book.deleted_at) return null;
    const s = book.share;
    const [reflection, passages, words, pages, checkins, essay] = await Promise.all([
      s.reflection ? db.reflections.get(id) : undefined,
      s.passages ? db.passages.where("book_id").equals(id).filter((p) => live(p) && !p.hidden && !!p.text.trim()).sortBy("created_at") : [],
      s.words ? db.words.where("book_id").equals(id).filter((w) => live(w) && !!w.word.trim()).sortBy("created_at") : [],
      s.pages ? db.pages.where("book_id").equals(id).filter(live).sortBy("position") : [],
      s.mood ? db.checkins.where("book_id").equals(id).filter(live).sortBy("created_at") : [],
      db.essays.get(id),
    ]);
    return { book, reflection: reflection && live(reflection) ? reflection : null, passages, words, pages, checkins, essay: essay && live(essay) ? essay : null };
  }, [id]);

  if (data === undefined) return null;
  if (data === null)
    return (
      <Page className="pt-16">
        <Empty>This book isn’t here.</Empty>
      </Page>
    );

  const username = profile?.username ?? "";
  const { book, reflection, essay } = data;
  const path = `/@${username}/${book.slug}${essayView ? "/essay" : ""}`;
  const mood = data.checkins.map((c) => ({ created_at: c.created_at, mood: c.mood, understanding: c.understanding, pages: c.pages }));
  const view: PublicBookData = {
    username,
    book,
    reflection,
    passages: data.passages.map((p) => ({ id: p.id, text: p.text, page: p.page, mark: p.mark, note: p.note })),
    words: data.words,
    pages: data.pages,
    mood,
    essay: essay?.published_at ? { title: essay.title, href: `/@${username}/${book.slug}/essay` } : null,
  };

  const close = () => {
    setImage(null);
    setFailed(false);
  };
  const fileName = `${book.slug}${essayView ? "-essay" : ""}.png`;
  // Capture once and show it; the actual save happens from the sheet's button.
  const capture = async () => {
    setSaving(true);
    setFailed(false);
    try {
      const blob = await captureImage(shot.current!);
      setImage({ blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      console.warn("[save image]", e);
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="relative z-[2] flex items-center justify-between gap-4 bg-ink px-6 pt-[calc(env(safe-area-inset-top)+14px)] pb-[14px] text-[13px] text-paper md:px-10 md:pt-[14px] md:text-sm">
        <p role="status">
          Previewing as a visitor
          <span className="hidden md:inline"> · {typeof location === "undefined" ? path : location.host + path}</span>
        </p>
        <div className="flex items-center gap-5">
          <button type="button" disabled={saving} onClick={capture} className="min-h-11 underline disabled:opacity-60">
            {saving ? "Making image…" : failed ? "Couldn't save, try again" : "Save as image"}
          </button>
          {/* A fixed destination: history.back() misbehaves when the preview was opened directly. */}
          <Link href={essayView ? `/essay?id=${book.id}` : `/book?id=${book.id}`} className="inline-flex min-h-11 items-center underline">
            Exit<span className="hidden md:inline">&nbsp;preview</span>
          </Link>
        </div>
      </div>
      <Page className="pt-[26px] md:pt-[60px]">
        {book.visibility === "private" && <p className="mb-6 text-[13px] text-muted">This book is private, so no one can see it yet. This is how it will look once shared.</p>}
        {/* Everything inside this box is what "Save as image" captures. */}
        <div ref={shot} className="-mx-6 px-6 pt-6 pb-10 md:-mx-10 md:max-w-[1180px] md:px-10 md:pt-10">
          <RoughDefs />
          {essayView ? (
            <PublicEssay
              headingLevel={1}
              data={{
                author: profile?.display_name || `@${username}`,
                book,
                title: essay?.title ?? "",
                body: essay?.body ?? "",
                published_at: essay?.published_at ?? null,
                verdict: reflection?.verdict ?? null,
                mood,
              }}
            />
          ) : (
            <PublicBook data={view} />
          )}
          <div className="mt-14 flex items-center justify-end gap-3 text-[13px] text-muted">
            {username && <span>@{username}</span>}
            <Logo size={14} />
          </div>
        </div>
        <p className="mt-16 text-xs text-muted md:text-[13px]">Photos, check-in notes and hidden passages aren’t shown. Margin notes on shared passages are.</p>
      </Page>
      <Sheet open={!!image} onClose={close} title="Save as image" className="md:w-[560px]">
        <h2 className="font-serif text-2xl">Save as image</h2>
        {image && (
          // eslint-disable-next-line @next/next/no-img-element -- local blob URL
          <img src={image.url} alt={`Preview of ${book.title}`} className="max-h-[55dvh] w-full rounded-lg border border-rule-soft object-contain" />
        )}
        {failed && <p className="text-[13px] text-muted">Couldn&apos;t save. Try again.</p>}
        <div className="flex justify-end gap-3">
          <Button variant="quiet" size="md" onClick={close}>
            Cancel
          </Button>
          <Button
            size="md"
            onClick={() =>
              saveImage(image!.blob, fileName).then(
                close,
                (e) => {
                  console.warn("[save image]", e);
                  setFailed(true);
                },
              )
            }
          >
            Save
          </Button>
        </div>
      </Sheet>
    </>
  );
}
