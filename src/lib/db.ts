import Dexie, { type EntityTable } from "dexie";
import type { Book, Checkin, Essay, FileRow, Passage, Profile, Reflection, ScrapPage, SyncTable, Word } from "./types";

// Local-first: IndexedDB is the source of truth for the UI. `_dirty` marks rows the
// sync engine still has to push; fields starting with "_" never leave the device.
type Local<T> = T & { _dirty?: 0 | 1 };

export type Meta = { key: string; value: unknown };

export class EndpaperDB extends Dexie {
  profiles!: EntityTable<Local<Profile>, "id">;
  books!: EntityTable<Local<Book>, "id">;
  passages!: EntityTable<Local<Passage>, "id">;
  words!: EntityTable<Local<Word>, "id">;
  checkins!: EntityTable<Local<Checkin>, "id">;
  reflections!: EntityTable<Local<Reflection>, "id">;
  essays!: EntityTable<Local<Essay>, "id">;
  pages!: EntityTable<Local<ScrapPage>, "id">;
  files!: EntityTable<FileRow, "id">;
  meta!: EntityTable<Meta, "key">;

  constructor() {
    super("endpaper");
    this.version(1).stores({
      profiles: "id, username, _dirty",
      books: "id, status, visibility, updated_at, _dirty",
      passages: "id, book_id, mark, created_at, _dirty",
      words: "id, book_id, passage_id, _dirty",
      checkins: "id, book_id, created_at, _dirty",
      reflections: "id, book_id, _dirty",
      essays: "id, book_id, _dirty",
      pages: "id, book_id, position, _dirty",
      files: "id, uploaded, deleted",
      meta: "key",
    });
  }
}

export const db = new EndpaperDB();

export const SYNC_TABLES: SyncTable[] = ["profiles", "books", "passages", "words", "checkins", "reflections", "essays", "pages"];

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}
export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value });
}

/** Wipe everything on this device (sign-out on a shared device, account deletion). */
export async function clearLocal() {
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}
