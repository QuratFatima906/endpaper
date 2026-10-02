import { db } from "./db";
import type { Book, Checkin, Essay, Mark, Passage, Reflection, ScrapPage, ShareSections, SyncTable, Word } from "./types";

// All writes go through here: local first, then the sync engine pushes dirty rows.

let uid = "local";
export const setUserId = (id: string) => void (uid = id);
export const userId = () => uid;

let onWrite: () => void = () => {};
export const onLocalWrite = (fn: () => void) => void (onWrite = fn);

export const now = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();

const base = () => {
  const t = now();
  return { id: newId(), user_id: uid, created_at: t, updated_at: t, deleted_at: null, _dirty: 1 as const };
};

export function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "untitled"
  );
}

type AnyTable = (typeof db)[SyncTable];

export async function patch<T extends object>(table: SyncTable, id: string, changes: Partial<T>) {
  await (db[table] as AnyTable).update(id, { ...changes, updated_at: now(), _dirty: 1 } as never);
  onWrite();
}

/** Soft delete (tombstone) so the deletion syncs to other devices. */
export async function remove(table: SyncTable, id: string) {
  await patch(table, id, { deleted_at: now() } as never);
}

const NO_SHARE: ShareSections = { reflection: false, passages: false, words: false, pages: false, mood: false };

/** Public URLs are /@user/<slug>, so slugs must be unique within a library. */
async function uniqueSlug(title: string) {
  const base = slugify(title);
  const taken = new Set((await db.books.toArray()).filter((b) => !b.deleted_at).map((b) => b.slug));
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

export async function addBook(b: Pick<Book, "title" | "author"> & Partial<Book>): Promise<string> {
  const slug = b.slug ?? (await uniqueSlug(b.title));
  const row: Book = {
    ...base(),
    isbn: null,
    cover_url: null,
    description: null,
    status: "reading",
    visibility: "private",
    share: NO_SHARE,
    started_at: now(),
    finished_at: null,
    source: "manual",
    goodreads_rating: null,
    goodreads_review: null,
    ...b,
    slug,
  };
  await db.books.add({ ...row, _dirty: 1 });
  onWrite();
  return row.id;
}

export async function addPassage(p: Partial<Passage>): Promise<string> {
  const row: Passage = { ...base(), book_id: null, image_id: null, text: "", alt: "", page: "", mark: null, note: "", hidden: false, ...p };
  await db.transaction("rw", db.passages, db.words, async () => {
    await db.passages.add({ ...row, _dirty: 1 });
    if (row.mark === "glossary" && row.book_id) await ensureGlossaryWord(row);
  });
  onWrite();
  return row.id;
}

/** R-WRD-1: a passage tagged g. creates a glossary entry (once). */
export async function ensureGlossaryWord(p: Pick<Passage, "id" | "book_id" | "text" | "page">) {
  if (!p.book_id) return;
  const existing = await db.words.where("passage_id").equals(p.id).first();
  if (existing && !existing.deleted_at) return;
  const guess = p.text.trim().split(/\s+/).length <= 3 ? p.text.trim() : "";
  await db.words.add({ ...base(), book_id: p.book_id, passage_id: p.id, word: guess, definition: "", page: p.page, _dirty: 1 });
}

export async function updatePassage(id: string, changes: Partial<Passage>) {
  await patch<Passage>("passages", id, changes);
  const p = await db.passages.get(id);
  if (p && p.mark === "glossary" && p.book_id) {
    await ensureGlossaryWord(p);
    onWrite();
  }
}

export async function addWord(w: Pick<Word, "book_id" | "word"> & Partial<Word>) {
  const row: Word = { ...base(), passage_id: null, definition: "", page: "", ...w };
  await db.words.add({ ...row, _dirty: 1 });
  onWrite();
  return row.id;
}

export async function addCheckin(c: Pick<Checkin, "book_id" | "mood" | "understanding"> & Partial<Checkin>) {
  const row: Checkin = { ...base(), minutes: null, pages: "", text: "", ...c };
  await db.checkins.add({ ...row, _dirty: 1 });
  onWrite();
  return row.id;
}

/** Reflection and essay are 1:1 with a book, keyed by the book id. */
export async function saveReflection(bookId: string, changes: Partial<Reflection>) {
  const existing = await db.reflections.get(bookId);
  if (existing) return patch<Reflection>("reflections", bookId, changes);
  await db.reflections.add({
    ...base(),
    id: bookId,
    book_id: bookId,
    takeaway: "",
    understood: "",
    unsure: "",
    recommend: "",
    verdict: null,
    ratings: {},
    ...changes,
  });
  onWrite();
}

export async function saveEssay(bookId: string, changes: Partial<Essay>) {
  const existing = await db.essays.get(bookId);
  if (existing) return patch<Essay>("essays", bookId, changes);
  const book = await db.books.get(bookId);
  await db.essays.add({
    ...base(),
    id: bookId,
    book_id: bookId,
    title: "",
    body: "",
    slug: slugify(changes.title || book?.title || "essay"),
    published_at: null,
    ...changes,
  });
  onWrite();
}

export async function addPage(bookId: string) {
  const count = await db.pages.where("book_id").equals(bookId).filter((p) => !p.deleted_at).count();
  const row: ScrapPage = { ...base(), book_id: bookId, position: count, items: [] };
  await db.pages.add({ ...row, _dirty: 1 });
  onWrite();
  return row.id;
}

// Image blobs. Stored locally immediately; uploaded by the sync engine.
export async function saveImage(blob: Blob): Promise<string> {
  const id = newId();
  await db.files.add({ id, user_id: uid, blob, mime: blob.type || "image/jpeg", uploaded: 0, deleted: 0 });
  onWrite();
  return id;
}

export async function deleteImage(id: string) {
  await db.files.update(id, { deleted: 1, blob: null });
  onWrite();
}

export const isMark = (m: unknown): m is Mark => ["key", "loved", "confusing", "disagree", "glossary"].includes(m as string);

/** R-ENG-4: deleting a book removes everything that belongs to it, photos included. */
export async function deleteBook(id: string) {
  const t = now();
  const gone = { deleted_at: t, updated_at: t, _dirty: 1 as const };
  const images: string[] = [];
  await db.transaction("rw", [db.books, db.passages, db.words, db.checkins, db.reflections, db.essays, db.pages], async () => {
    for (const table of [db.passages, db.words, db.checkins, db.reflections, db.essays, db.pages] as const) {
      const rows = await (table as typeof db.passages).where("book_id").equals(id).filter((r) => !r.deleted_at).toArray();
      for (const r of rows) {
        if (r.image_id) images.push(r.image_id);
        await (table as typeof db.passages).update(r.id, gone);
      }
    }
    await db.books.update(id, gone);
  });
  for (const img of images) await deleteImage(img);
  onWrite();
}
