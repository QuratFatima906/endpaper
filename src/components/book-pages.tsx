"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { db } from "@/lib/db";
import { markOf } from "@/lib/marks";
import { addPage, newId, patch, remove } from "@/lib/repo";
import type { PageItem, Passage, ScrapPage } from "@/lib/types";
import { BottomAction, Button, Empty, RoughBorder, Sheet, TextArea, cx } from "@/components/ui";
import { Portal, useDraft } from "@/components/book-draft";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const WIDTH: Record<PageItem["kind"], number> = { passage: 0.6, text: 0.5, tape: 0.25, corners: 0.09 };
const TILT = [-2, 1.5, -1, 2.5];

function describe(it: PageItem, p?: Passage) {
  if (it.kind === "passage") return `Passage${p?.page ? `, p. ${p.page}` : ""}: ${p?.text || p?.note || "no text yet"}`;
  if (it.kind === "text") return `Note: ${it.text || "empty"}`;
  return it.kind === "tape" ? "Tape strip" : "Photo corner";
}

/** What an item looks like on the paper. */
function ItemFace({ it, p }: { it: PageItem; p?: Passage }) {
  if (it.kind === "passage")
    return (
      <div className="bg-surface p-4 shadow-[0_1px_1px_rgba(27,29,34,.06),0_6px_14px_-6px_var(--shadow)]">
        <p className="line-clamp-6 font-serif text-[15px] leading-[1.4] italic md:text-[17px]">{p?.text || p?.note || "Passage"}</p>
        <p className="mt-2 flex items-baseline gap-2 text-xs text-muted not-italic">
          {p?.mark && <span className="font-serif text-base text-accent">{markOf(p.mark)?.glyph}</span>}
          {p?.page && <span>p. {p.page}</span>}
        </p>
      </div>
    );
  if (it.kind === "text") return <p className="font-hand text-lg leading-[1.35] text-accent whitespace-pre-wrap md:text-xl">{it.text || "…"}</p>;
  if (it.kind === "tape") return <div className="rough-big h-5 w-full" style={{ background: "var(--tape)" }} />;
  return (
    <svg viewBox="0 0 30 30" className="rough block w-full" aria-hidden="true">
      <path d="M2 28 L2 2 L28 2 Z" fill="var(--surface)" stroke="var(--rule)" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function PageEditor({ page, bookId, index, pages, onOpen, onClose }: { page: ScrapPage; bookId: string; index: number; pages: ScrapPage[]; onOpen: (id: string) => void; onClose: () => void }) {
  const [items, setItems] = useDraft<PageItem[]>(page.items, (v) => patch<ScrapPage>("pages", page.id, { items: v }));
  const passages = useLiveQuery(() => db.passages.where("book_id").equals(bookId).filter((p) => !p.deleted_at).reverse().sortBy("created_at"), [bookId]);
  const byId = new Map((passages ?? []).map((p) => [p.id, p]));
  const [sel, setSel] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"passage" | "order" | "delete" | null>(null);
  const [textEdit, setTextEdit] = useState<{ id: string | null; value: string } | null>(null);
  const canvas = useRef<HTMLOListElement>(null);
  const drag = useRef<{ pid: number; id: string; sx: number; sy: number; x: number; y: number; w: number; h: number } | null>(null);
  const hint = useId();

  const update = (id: string, ch: Partial<PageItem>) => setItems(items.map((i) => (i.id === id ? { ...i, ...ch } : i)));
  const drop = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
    setSel(null);
  };
  function add(kind: PageItem["kind"], extra: Partial<PageItem> = {}) {
    const n = items.length;
    const it: PageItem = { id: newId(), kind, x: 0.08 + (n % 6) * 0.05, y: 0.06 + (n % 6) * 0.12, w: WIDTH[kind], r: kind === "corners" ? 0 : TILT[n % 4], ...extra };
    setItems([...items, it]);
    setSel(it.id);
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    setItems(next);
  }

  function down(e: PointerEvent<HTMLLIElement>, it: PageItem) {
    if (drag.current || e.button !== 0 || !canvas.current) return; // one finger at a time
    const r = canvas.current.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { pid: e.pointerId, id: it.id, sx: e.clientX, sy: e.clientY, x: it.x, y: it.y, w: r.width, h: r.height };
    setSel(it.id);
  }
  function moveTo(e: PointerEvent<HTMLLIElement>) {
    const d = drag.current;
    if (!d || d.pid !== e.pointerId) return;
    update(d.id, { x: clamp(d.x + (e.clientX - d.sx) / d.w, 0, 0.95), y: clamp(d.y + (e.clientY - d.sy) / d.h, 0, 0.97) });
  }
  function up(e: PointerEvent<HTMLLIElement>) {
    if (drag.current?.pid === e.pointerId) drag.current = null;
  }
  function key(e: KeyboardEvent<HTMLLIElement>, it: PageItem) {
    const s = e.shiftKey ? 0.05 : 0.01;
    const k = e.key;
    const ch: Partial<PageItem> | null =
      k === "ArrowLeft" ? { x: clamp(it.x - s, 0, 0.95) }
      : k === "ArrowRight" ? { x: clamp(it.x + s, 0, 0.95) }
      : k === "ArrowUp" ? { y: clamp(it.y - s, 0, 0.97) }
      : k === "ArrowDown" ? { y: clamp(it.y + s, 0, 0.97) }
      : k === "[" || k === "{" ? { r: it.r - (e.shiftKey ? 15 : 2) }
      : k === "]" || k === "}" ? { r: it.r + (e.shiftKey ? 15 : 2) }
      : null;
    if (ch) {
      e.preventDefault();
      update(it.id, ch);
    } else if (k === "Delete" || k === "Backspace") {
      e.preventDefault();
      drop(it.id);
    } else if (k === "Enter" && it.kind === "text") {
      e.preventDefault();
      setTextEdit({ id: it.id, value: it.text ?? "" });
    }
  }

  function saveText() {
    if (!textEdit) return;
    const v = textEdit.value.trim();
    if (textEdit.id) update(textEdit.id, { text: v });
    else if (v) add("text", { text: v });
    setTextEdit(null);
  }

  const tool = "press min-h-11 px-2 text-[13px] md:text-left md:text-sm";
  const selected = items.find((i) => i.id === sel);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onClose} className="min-h-11 text-sm text-muted hover:text-ink">
          ← All pages
        </button>
        <h2 className="font-serif text-[15px] md:text-lg">
          Page {index + 1} of {pages.length}
        </h2>
        <button type="button" onClick={onClose} className="min-h-11 text-sm font-medium text-accent">
          Done
        </button>
      </div>

      <div className="mt-4 grid gap-10 md:grid-cols-[120px_minmax(0,560px)_180px]">
        {/* Toolbar: bottom bar on phones, left column on desktop. */}
        <div role="toolbar" aria-label="Add to page" className="no-print fixed inset-x-0 bottom-0 z-10 flex h-24 items-center justify-around border-t border-rule-soft bg-paper pb-[env(safe-area-inset-bottom)] md:static md:h-auto md:flex-col md:items-start md:justify-start md:gap-2 md:border-0 md:bg-transparent">
          <button type="button" className={tool} onClick={() => setSheet("passage")}>Passage</button>
          <button type="button" className={tool} onClick={() => setTextEdit({ id: null, value: "" })}>Text</button>
          <button type="button" className={tool} onClick={() => add("tape")}>Tape</button>
          <button type="button" className={tool} onClick={() => add("corners")}>Corners</button>
          <button type="button" className={cx(tool, "text-muted md:mt-5")} onClick={() => setSheet("order")}>Reading order</button>
          {selected && (
            <button type="button" className={cx(tool, "text-accent md:mt-5")} onClick={() => drop(selected.id)}>
              Remove<span className="sr-only"> {describe(selected, byId.get(selected.passage_id ?? ""))}</span>
            </button>
          )}
        </div>

        <div className="md:col-start-2 md:row-start-1">
          <p id={hint} className="sr-only">
            Drag to move. With the keyboard: arrow keys move, Shift for bigger steps, [ and ] rotate, Delete removes, Enter edits a note.
          </p>
          <ol
            ref={canvas}
            aria-label={`Page ${index + 1}, pieces in reading order`}
            className="relative m-0 aspect-[3/4] w-full list-none overflow-hidden bg-surface p-0 shadow-[0_1px_2px_rgba(27,29,34,.08),0_0_0_1px_var(--rule-soft)]"
            onPointerDown={(e) => e.target === e.currentTarget && setSel(null)}
          >
            {items.map((it) => {
              const p = it.passage_id ? byId.get(it.passage_id) : undefined;
              return (
                <li
                  key={it.id}
                  tabIndex={0}
                  aria-describedby={hint}
                  aria-label={describe(it, p)}
                  onPointerDown={(e) => down(e, it)}
                  onPointerMove={moveTo}
                  onPointerUp={up}
                  onPointerCancel={up}
                  onFocus={() => setSel(it.id)}
                  onKeyDown={(e) => key(e, it)}
                  onDoubleClick={() => it.kind === "text" && setTextEdit({ id: it.id, value: it.text ?? "" })}
                  className={cx("absolute cursor-grab touch-none select-none active:cursor-grabbing", sel === it.id && "outline-2 outline-offset-4 outline-accent outline-dashed")}
                  style={{ left: `${it.x * 100}%`, top: `${it.y * 100}%`, width: `${it.w * 100}%`, transform: `rotate(${it.r}deg)` }}
                >
                  <ItemFace it={it} p={p} />
                </li>
              );
            })}
          </ol>
          {items.length === 0 && <p className="mt-3 text-sm text-muted">An empty page. Add a passage, a note, some tape.</p>}
          <button type="button" onClick={() => setSheet("delete")} className="mt-4 min-h-11 text-sm underline">
            Delete page
          </button>
        </div>

        <nav aria-label="Pages" className="hidden flex-col gap-[14px] md:flex">
          <span className="text-xs font-medium tracking-[.06em] text-muted uppercase">Pages</span>
          {pages.map((pg, i) => (
            <button
              key={pg.id}
              type="button"
              aria-current={pg.id === page.id ? "page" : undefined}
              onClick={() => onOpen(pg.id)}
              className={cx("relative flex h-[110px] items-end p-2 text-xs", pg.id === page.id ? "text-accent" : "text-muted")}
            >
              <RoughBorder radius={0} fill="var(--surface)" color={pg.id === page.id ? "var(--accent)" : "var(--field)"} width={pg.id === page.id ? 2 : 1.2} />
              <span className="relative">Page {i + 1}</span>
            </button>
          ))}
        </nav>
      </div>

      <Sheet open={sheet === "passage"} onClose={() => setSheet(null)} title="Add a passage">
        <h2 className="font-serif text-[28px] leading-[1.1]">Add a passage</h2>
        {passages?.length ? (
          <ul className="-mx-2 flex max-h-[50vh] flex-col overflow-y-auto">
            {passages.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="min-h-11 w-full rounded-lg px-2 py-3 text-left hover:bg-accent-wash"
                  onClick={() => {
                    add("passage", { passage_id: p.id });
                    setSheet(null);
                  }}
                >
                  <span className="line-clamp-2 font-serif text-[17px]">{p.text || p.note || "Untitled passage"}</span>
                  {p.page && <span className="text-xs text-muted">p. {p.page}</span>}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No passages in this book yet.</Empty>
        )}
      </Sheet>

      <Sheet open={sheet === "order"} onClose={() => setSheet(null)} title="Reading order">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-[28px] leading-[1.1]">Reading order</h2>
          <p className="text-sm text-muted">The order a screen reader reads this page in.</p>
        </div>
        {items.length ? (
          <ol className="flex flex-col gap-2">
            {items.map((it, i) => (
              <li key={it.id} className="flex items-center gap-3">
                <span className="w-5 font-serif text-accent italic">{i + 1}</span>
                <span className="line-clamp-2 flex-1 text-sm">{describe(it, byId.get(it.passage_id ?? ""))}</span>
                <button type="button" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move ${i + 1} up`} className="size-11 disabled:opacity-30">
                  ↑
                </button>
                <button type="button" disabled={i === items.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move ${i + 1} down`} className="size-11 disabled:opacity-30">
                  ↓
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <Empty>Nothing on this page yet.</Empty>
        )}
        <Button variant="outline" size="md" onClick={() => setSheet(null)}>
          Done
        </Button>
      </Sheet>

      <Sheet open={!!textEdit} onClose={() => setTextEdit(null)} title="Note on the page">
        <h2 className="font-serif text-[28px] leading-[1.1]">{textEdit?.id ? "Edit note" : "Write on the page"}</h2>
        <TextArea hand aria-label="Note" autoFocus placeholder="a line in your own hand" value={textEdit?.value ?? ""} onChange={(e) => setTextEdit((t) => t && { ...t, value: e.target.value })} />
        <Button onClick={saveText}>{textEdit?.id ? "Save" : "Add to page"}</Button>
      </Sheet>

      <Sheet open={sheet === "delete"} onClose={() => setSheet(null)} title="Delete page">
        <h2 className="font-serif text-[28px] leading-[1.1]">Delete this page?</h2>
        <p className="text-muted">The passages stay in your book; only this arrangement goes.</p>
        <div className="flex flex-col gap-3 md:flex-row-reverse">
          <Button
            onClick={async () => {
              await remove("pages", page.id);
              setSheet(null);
              onClose();
            }}
          >
            Delete page
          </Button>
          <Button variant="outline" onClick={() => setSheet(null)}>
            Keep it
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

export function BookPages({ bookId }: { bookId: string }) {
  const pages = useLiveQuery(
    async () => (await db.pages.where("book_id").equals(bookId).filter((p) => !p.deleted_at).toArray()).sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at)),
    [bookId],
  );
  const [open, setOpen] = useState<string | null>(null);
  const idx = pages?.findIndex((p) => p.id === open) ?? -1;

  async function add() {
    setOpen(await addPage(bookId));
  }

  if (!pages) return null;
  if (idx >= 0) return <PageEditor key={pages[idx].id} page={pages[idx]} bookId={bookId} index={idx} pages={pages} onOpen={setOpen} onClose={() => setOpen(null)} />;

  return (
    <>
      <h2 className="sr-only">Pages</h2>
      {pages.length === 0 ? (
        <div className="mt-8">
          <Empty>No pages yet. Arrange passages, notes and tape on a page of your own.</Empty>
        </div>
      ) : (
        <ul className="mt-7 grid grid-cols-2 gap-5 md:grid-cols-5">
          {pages.map((p, i) => (
            <li key={p.id}>
              <button type="button" onClick={() => setOpen(p.id)} className="press relative flex aspect-[3/4] w-full flex-col items-start justify-end p-3 text-left">
                <RoughBorder radius={0} fill="var(--surface)" />
                <span className="relative font-serif text-lg">Page {i + 1}</span>
                <span className="relative text-xs text-muted">{p.items.length === 1 ? "1 piece" : `${p.items.length} pieces`}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-8 hidden md:block">
        <Button variant="outline" size="md" onClick={add}>
          Add a page
        </Button>
      </div>
      <Portal>
        <BottomAction>
        <Button variant="outline" onClick={add} className="bg-paper">
          Add a page
        </Button>
      </BottomAction>
      </Portal>
    </>
  );
}
