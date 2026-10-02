import type { Book } from "@/lib/types";

// Case- and accent-insensitive text helpers for search and duplicate detection.

/** Folds each character on its own and remembers where it came from, so a match in the
 *  folded text maps back to the original (for highlighting). */
function foldMap(s: string) {
  let out = "";
  const at: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const f = s[i].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    out += f;
    for (let k = 0; k < f.length; k++) at.push(i);
  }
  return { out, at };
}

export const fold = (s: string) => foldMap(s).out;

/** [start, end) of the first match of `q` in `s`, in original indices; null if none. */
export function findMatch(s: string, q: string): [number, number] | null {
  const needle = fold(q.trim());
  if (!needle || !s) return null;
  const { out, at } = foldMap(s);
  const i = out.indexOf(needle);
  return i < 0 ? null : [at[i], at[i + needle.length - 1] + 1];
}

const norm = (s: string) => fold(s).replace(/[^a-z0-9]+/g, " ").trim();
const digits = (s: string | null | undefined) => (s ?? "").replace(/[^0-9Xx]/g, "").toUpperCase();

/** Same ISBN, or same title + author (ignoring case, accents, punctuation). */
export function findDuplicate<B extends Pick<Book, "title" | "author" | "isbn" | "deleted_at">>(books: B[], c: { title: string; author: string; isbn?: string | null }) {
  const isbn = digits(c.isbn);
  const key = `${norm(c.title)}|${norm(c.author)}`;
  return books.find((b) => !b.deleted_at && ((isbn && digits(b.isbn) === isbn) || `${norm(b.title)}|${norm(b.author)}` === key));
}
