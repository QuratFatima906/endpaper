"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { AppHeader, BackLink, Button, cx, Page, RoughBorder } from "@/components/ui";
import { db } from "@/lib/db";
import { download, exportZip } from "@/lib/export";
import { markOf, statusLabel } from "@/lib/marks";

const OPTIONS = [
  { id: "zip", title: "Full backup", text: "A ZIP with all your books, passages, notes and original photos." },
  { id: "print", title: "Printable scrapbook", text: "Every book with its reflection and passages, ready to print or save as a PDF." },
] as const;

export default function Export() {
  const [choice, setChoice] = useState<"zip" | "print">("zip");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function backup() {
    setBusy(true);
    setNote(null);
    try {
      const { blob, missing } = await exportZip();
      download(blob, `endpaper-${new Date().toISOString().slice(0, 10)}.zip`);
      setNote(
        missing
          ? `Downloaded. ${missing} ${missing === 1 ? "photo wasn't" : "photos weren't"} on this device and couldn't be fetched; ${missing === 1 ? "it's" : "they're"} listed in data.json. Try again when you're online.`
          : "Downloaded. Keep it somewhere safe.",
      );
    } catch {
      setNote("Couldn't build the backup. Please try again.");
    }
    setBusy(false);
  }

  return (
    <Page>
      <div className="print:hidden">
        <div className="hidden md:block">
          <AppHeader />
        </div>
        <div className="mx-auto max-w-[640px]">
          <div className="pt-[calc(env(safe-area-inset-top)+50px)] md:pt-[40px]">
            <BackLink href="/settings">Settings</BackLink>
          </div>
          <h1 className="mt-[26px] font-serif text-[32px] leading-[1.1] md:mt-4 md:text-[40px]">Take it with you</h1>
          <p className="mt-[10px] text-sm leading-normal text-muted md:text-[15px]">Everything you&apos;ve made here belongs to you.</p>

          <div role="radiogroup" aria-label="What to export" className="mt-7 flex flex-col gap-3">
            {OPTIONS.map((o) => {
              const on = choice === o.id;
              return (
                <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => setChoice(o.id)} className="press relative flex flex-col gap-1 p-[18px] text-left">
                  <RoughBorder radius={12} color={on ? "var(--accent)" : "var(--field)"} width={on ? 2 : 1.5} fill={on ? "var(--accent-wash)" : undefined} />
                  <span className={cx("relative font-serif text-[19px]", on && "text-accent")}>{o.title}</span>
                  <span className={cx("relative text-[13px] leading-normal", !on && "text-muted")}>{o.text}</span>
                </button>
              );
            })}
          </div>

          <p role="status" className="mt-[26px] text-sm leading-normal text-muted">
            {note ?? (choice === "zip" ? "It downloads straight to this device. Stay online so photos from your other devices can come too." : "Choose “Save as PDF” in the print dialog to keep a copy.")}
          </p>

          <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+24px)] mt-8 flex md:static">
            {choice === "zip" ? (
              <Button onClick={backup} disabled={busy} className="w-full md:h-12 md:w-auto md:rounded-3xl">
                {busy ? "Preparing…" : "Prepare backup"}
              </Button>
            ) : (
              <Button onClick={() => window.print()} className="w-full md:h-12 md:w-auto md:rounded-3xl">
                Print or save as PDF
              </Button>
            )}
          </div>
        </div>
      </div>
      {choice === "print" && <PrintView />}
    </Page>
  );
}

/** Whole-library print view: hidden on screen, the only thing on paper. */
function PrintView() {
  const data = useLiveQuery(async () => {
    const [books, reflections, passages] = await Promise.all([
      db.books.filter((b) => !b.deleted_at).toArray(),
      db.reflections.filter((r) => !r.deleted_at).toArray(),
      db.passages.filter((p) => !p.deleted_at && !!p.book_id).sortBy("created_at"),
    ]);
    return { books: books.sort((a, b) => a.title.localeCompare(b.title)), reflections, passages };
  }, []);
  if (!data) return null;
  return (
    <section className="hidden font-serif print:block">
      {data.books.map((b) => {
        const r = data.reflections.find((x) => x.book_id === b.id);
        const ps = data.passages.filter((p) => p.book_id === b.id && p.text.trim());
        return (
          <article key={b.id} className="mb-10 break-inside-avoid-page">
            <h2 className="text-2xl">{b.title}</h2>
            <p className="font-sans text-sm">
              {b.author} · {statusLabel(b.status)}
            </p>
            {r && [r.takeaway, r.understood, r.unsure, r.recommend].filter((t) => t.trim()).map((t, i) => <p key={i} className="mt-3 whitespace-pre-wrap">{t}</p>)}
            {b.goodreads_review && <p className="mt-3 whitespace-pre-wrap">{b.goodreads_review}</p>}
            {ps.map((p) => (
              <blockquote key={p.id} className="mt-4 border-l-2 border-rule pl-4">
                <p className="whitespace-pre-wrap">
                  {markOf(p.mark)?.glyph} {p.text}
                </p>
                {(p.page || p.note) && (
                  <p className="mt-1 font-sans text-xs">
                    {p.page && `p. ${p.page}`} {p.note}
                  </p>
                )}
              </blockquote>
            ))}
          </article>
        );
      })}
    </section>
  );
}
