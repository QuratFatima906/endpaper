"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/db";
import { extractText, prepareImage } from "@/lib/images";
import { addPassage, saveImage, updatePassage } from "@/lib/repo";
import type { Mark } from "@/lib/types";
import { AppHeader, BackLink, Button, Eyebrow, Page, TextArea, TextField } from "@/components/ui";
import { BookSelect, MarkPicker, Switch } from "@/components/book-passage-editor";
import { CropBox, FULL, type Box } from "@/components/capture-crop";

/** OCR after the passage is saved, so capture never waits on it. Never overwrites typed text. */
async function readLater(id: string, blob: Blob) {
  try {
    const text = await extractText(blob);
    const p = await db.passages.get(id);
    if (text && p && !p.deleted_at && !p.text) await updatePassage(id, { text, alt: p.alt || text });
  } catch {
    // Offline without the OCR model cached: leave it empty; the passage page lets them type it.
  }
}

function CaptureScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const [bookId, setBookId] = useState<string | null>(params.get("book"));
  const book = useLiveQuery(async () => (bookId ? ((await db.books.get(bookId)) ?? null) : null), [bookId]);
  const [file, setFile] = useState<File | null>(null);
  const [typing, setTyping] = useState(false);
  const [box, setBox] = useState<Box>(FULL);
  const [enhance, setEnhance] = useState(true);
  const [mark, setMark] = useState<Mark | null>(null);
  const [page, setPage] = useState("");
  const [note, setNote] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const upload = useRef<HTMLInputElement>(null);

  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  const back = bookId && book ? `/book?id=${bookId}` : "/library";
  const pick = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setTyping(false);
    setBox(FULL);
    setError(null);
  };

  async function save(untagged: boolean) {
    setSaving(true);
    setError(null);
    try {
      let blob: Blob | null = null;
      let image_id: string | null = null;
      if (file) {
        blob = await prepareImage(file, { crop: { x: box.x0, y: box.y0, w: box.x1 - box.x0, h: box.y1 - box.y0 }, enhance });
        image_id = await saveImage(blob);
      }
      const t = text.trim();
      const id = await addPassage({ book_id: bookId, image_id, text: t, alt: t, page: page.trim(), mark: untagged ? null : mark, note: note.trim() });
      if (blob && !t) void readLater(id, blob);
      router.push(bookId ? `/book?id=${bookId}` : "/inbox");
    } catch {
      setError("Couldn't save that photo. Try another one, or type the passage instead.");
      setSaving(false);
    }
  }

  const ready = !!file || (typing && !!(text.trim() || note.trim()));
  const inputs = (
    <>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} tabIndex={-1} aria-hidden="true" />
      <input ref={upload} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} tabIndex={-1} aria-hidden="true" />
    </>
  );

  return (
    <Page>
      {inputs}
      <div className="hidden md:block">
        <AppHeader active="library" />
      </div>
      <div className="pt-[calc(env(safe-area-inset-top)+18px)] md:pt-[30px]">
        <BackLink href={back}>Cancel</BackLink>
        <h1 className="mt-2 font-serif text-[32px] leading-none md:text-4xl">New passage</h1>
        {book && <p className="mt-2 font-serif text-[17px] text-muted italic md:hidden">{book.title}</p>}
      </div>

      <div className="mt-[26px] grid gap-8 md:grid-cols-[1fr_400px] md:gap-12">
        <div>
          {file && url ? (
            <div className="flex flex-col gap-4">
              <div className="flex justify-center rounded-[10px] bg-canvas p-4 md:min-h-[480px] md:items-center md:p-10">
                <CropBox src={url} box={box} onChange={setBox} enhance={enhance} />
              </div>
              <p className="text-center text-[13px] text-muted">
                <button type="button" onClick={() => camera.current?.click()} className="min-h-11 text-ink underline">
                  Retake photo
                </button>{" "}
                · drag corners to crop
              </p>
              <Switch label="Improve contrast" checked={enhance} onChange={setEnhance} />
            </div>
          ) : typing ? (
            <TextArea label="The passage" minRows={5} className="[&_textarea]:font-serif [&_textarea]:text-[19px]" autoFocus placeholder="Type the lines that stopped you…" value={text} onChange={(e) => setText(e.target.value)} />
          ) : (
            <div className="flex flex-col gap-3 rounded-[10px] md:bg-canvas md:p-10">
              <Button onClick={() => camera.current?.click()}>Take a photo</Button>
              <Button variant="outline" onClick={() => upload.current?.click()}>
                Upload an image
              </Button>
              <button type="button" onClick={() => setTyping(true)} className="min-h-11 text-sm underline">
                Type it instead
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-[22px]">
          <BookSelect value={bookId} onChange={setBookId} />
          {(file || typing) && (
            <>
              <div className="flex flex-col gap-3">
                <Eyebrow>Mark</Eyebrow>
                <MarkPicker value={mark} onChange={setMark} />
              </div>
              <TextField label="Page" value={page} onChange={(e) => setPage(e.target.value)} className="max-w-[200px]" />
              <TextArea label="Margin note" hand placeholder="a thought, if you have one" value={note} onChange={(e) => setNote(e.target.value)} />
              {error && (
                <p role="alert" className="text-[13px] text-accent">
                  {error}
                </p>
              )}
              <div className="flex flex-col items-center gap-[14px] md:flex-row md:gap-[18px]">
                <Button onClick={() => save(false)} disabled={!ready || saving} className="w-full md:h-12 md:w-auto">
                  {saving ? "Saving…" : "Save passage"}
                </Button>
                <button type="button" onClick={() => save(true)} disabled={!ready || saving} className="min-h-11 text-sm underline disabled:opacity-50">
                  Save untagged to inbox
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Page>
  );
}

export default function CapturePage() {
  return (
    <Suspense>
      <CaptureScreen />
    </Suspense>
  );
}
