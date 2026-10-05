"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useId, useState } from "react";
import { db } from "@/lib/db";
import { extractText } from "@/lib/images";
import { MARKS } from "@/lib/marks";
import { deleteImage, remove, updatePassage } from "@/lib/repo";
import type { Mark, Passage } from "@/lib/types";
import { Button, Eyebrow, Label, RoughBorder, Rule, SavedHint, Sheet, TextArea, TextField, TippedPhoto, useTooltip } from "@/components/ui";
import { cx } from "@/lib/cx";
import { useDraft } from "@/components/book-draft";

/** The five printer's marks as big glyph buttons (capture + passage detail). Tap again to clear. */
export function MarkPicker({ value, onChange }: { value: Mark | null; onChange: (m: Mark | null) => void }) {
  return (
    <div role="group" aria-label="Mark" className="grid grid-cols-5 gap-2">
      {MARKS.map((m) => (
        <MarkOption key={m.id} mark={m} on={value === m.id} onClick={() => onChange(value === m.id ? null : m.id)} />
      ))}
    </div>
  );
}

function MarkOption({ mark: m, on, onClick }: { mark: (typeof MARKS)[number]; on: boolean; onClick: () => void }) {
  const { trigger, bubble } = useTooltip(m.hint);
  return (
    <span className="relative grid">
      <button
        type="button"
        aria-pressed={on}
        aria-label={m.spoken}
        onClick={onClick}
        className={cx("press relative flex h-[52px] items-center justify-center font-serif", m.id === "disagree" ? "text-[30px]" : "text-2xl", on ? "text-accent" : "text-ink", m.id === "glossary" && "italic")}
        {...trigger}
      >
        <RoughBorder radius={10} color={on ? "var(--accent)" : "var(--field)"} width={on ? 2 : 1.5} fill={on ? "var(--accent-wash)" : undefined} />
        <span className="relative" aria-hidden="true">
          {m.glyph}
        </span>
      </button>
      {bubble}
    </span>
  );
}

/** Native select for picking a book (or the inbox). */
export function BookSelect({ value, onChange, label = "Book" }: { value: string | null; onChange: (id: string | null) => void; label?: string }) {
  const id = useId();
  const books = useLiveQuery(() => db.books.filter((b) => !b.deleted_at).toArray(), []);
  const sorted = [...(books ?? [])].sort((a, b) => (a.status === b.status ? a.title.localeCompare(b.title) : a.status === "reading" ? -1 : 1));
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} caps>
        {label}
      </Label>
      <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className="min-h-11 max-w-full bg-transparent font-serif text-xl italic text-ink outline-none">
        <option value="">No book (inbox)</option>
        {sorted.map((b) => (
          <option key={b.id} value={b.id}>
            {b.title}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex min-h-11 w-full items-center justify-between gap-4 text-left text-sm">
      <span>{label}</span>
      <span className="relative h-[26px] w-11 flex-none">
        <RoughBorder radius={13} color={checked ? "var(--accent)" : "var(--field)"} fill={checked ? "var(--accent-wash)" : undefined} />
        <span className={cx("absolute top-1 size-[18px] rounded-full transition-[left] duration-150", checked ? "left-[22px] bg-accent" : "left-1 bg-field")} />
      </span>
    </button>
  );
}

// A passage's text is the default alt text: keep alt in step until someone edits it separately.
async function saveText(id: string, text: string) {
  const p = await db.passages.get(id);
  if (!p) return;
  await updatePassage(id, { text, ...(p.alt === "" || p.alt === p.text ? { alt: text } : {}) });
}

/** Everything editable about one passage. Used by /passage and the desktop book view. */
export function PassageEditor({ passage: p, onDeleted, side }: { passage: Passage; onDeleted: () => void; side?: boolean }) {
  const [text, setText] = useDraft(p.text, (v) => saveText(p.id, v));
  const [alt, setAlt] = useDraft(p.alt, (v) => updatePassage(p.id, { alt: v }));
  const [page, setPage] = useDraft(p.page, (v) => updatePassage(p.id, { page: v }));
  const [note, setNote] = useDraft(p.note, (v) => updatePassage(p.id, { note: v }));
  const [reading, setReading] = useState<"idle" | "busy" | "failed">("idle");
  const [confirm, setConfirm] = useState(false);
  const textId = useId();

  async function reread() {
    setReading("busy");
    try {
      const blob = p.image_id ? (await db.files.get(p.image_id))?.blob : null;
      if (!blob) throw new Error("no image");
      const t = await extractText(blob);
      await saveText(p.id, t);
      setReading("idle");
    } catch {
      setReading("failed");
    }
  }

  async function del() {
    await remove("passages", p.id);
    if (p.image_id) await deleteImage(p.image_id);
    setConfirm(false);
    onDeleted();
  }

  return (
    <div className={cx("flex flex-col gap-6", side && p.image_id && "md:grid md:grid-cols-2 md:gap-10", side && !p.image_id && "max-w-[560px]")}>
      {p.image_id && <TippedPhoto imageId={p.image_id} alt={p.alt || p.text || "Photo of the passage"} rotate={side ? -1.2 : 1} className="mt-3" />}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-4">
            <label htmlFor={textId}>
              <Eyebrow>{p.image_id ? "Text from photo" : "Text"}</Eyebrow>
            </label>
            <SavedHint at={p.updated_at} />
          </div>
          <textarea
            id={textId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={reading === "busy" ? "Reading the photo…" : "Type the passage…"}
            rows={2}
            className="block w-full resize-none bg-transparent font-serif text-[19px] leading-[1.4] outline-none [field-sizing:content] md:text-[21px]"
          />
          <Rule soft />
          {p.image_id && (
            <div className="flex items-center gap-3">
              <button type="button" onClick={reread} disabled={reading === "busy"} className="min-h-11 text-left text-sm text-accent underline disabled:opacity-60">
                {reading === "busy" ? "Reading the photo…" : "Re-read text from photo"}
              </button>
              {reading === "failed" && (
                <span role="status" className="text-[13px] text-muted">
                  Couldn&apos;t read it this time. You can type it.
                </span>
              )}
            </div>
          )}
        </div>

        {p.image_id && <TextField label="Photo description (alt text)" hint="Read aloud by screen readers. Starts as the passage text." value={alt} onChange={(e) => setAlt(e.target.value)} />}

        <div className="flex flex-col gap-3">
          <Eyebrow>Mark</Eyebrow>
          <MarkPicker value={p.mark} onChange={(m) => updatePassage(p.id, { mark: m })} />
        </div>

        <TextField label="Page" value={page} onChange={(e) => setPage(e.target.value)} inputMode="text" className="max-w-[200px]" />
        <TextArea label="Margin note" hand placeholder="a thought, if you have one" value={note} onChange={(e) => setNote(e.target.value)} />

        <BookSelect label="Book" value={p.book_id} onChange={(b) => updatePassage(p.id, { book_id: b })} />
        <Rule soft />
        <Switch label="Hide if the book is shared" checked={p.hidden} onChange={(v) => updatePassage(p.id, { hidden: v })} />
        <Rule soft />
        <button type="button" onClick={() => setConfirm(true)} className="min-h-11 self-start text-sm underline">
          Delete passage
        </button>
      </div>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Delete passage">
        <h2 className="font-serif text-[28px] leading-[1.1]">Delete this passage?</h2>
        <p className="text-muted">The photo and its text go too. This can&apos;t be undone.</p>
        <div className="flex flex-col gap-3 md:flex-row-reverse">
          <Button onClick={del}>Delete passage</Button>
          <Button variant="outline" onClick={() => setConfirm(false)}>
            Keep it
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
