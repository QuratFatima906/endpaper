import type { Book, Status } from "./types";

/** RFC 4180 CSV: quoted fields, "" escapes, commas/newlines inside quotes, CRLF or LF, leading BOM. */
export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows.filter((r) => r.some((f) => f.trim()));
}

/** Goodreads writes ISBNs as ="0141439513" to stop spreadsheets eating the zeros. */
export const cleanIsbn = (s: string | undefined) => (s ?? "").replace(/[^0-9Xx]/g, "").toUpperCase() || null;

export type GoodreadsBook = {
  key: number;
  title: string;
  author: string;
  isbn: string | null; // ISBN-13 when present, else ISBN-10
  isbn10: string | null;
  shelf: string; // Goodreads "Exclusive Shelf"
  rating: number | null; // 1–5, null when unrated (Goodreads uses 0)
  review: string | null;
  dateRead: string | null; // ISO
  year: string | null; // year read, for the preview line
};

// "2024/03/15" → ISO at noon UTC so the date doesn't slip a day in any timezone.
function toIso(s: string | undefined) {
  const m = s?.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Parses a Goodreads library export. Columns are found by header name, never by position. */
export function parseGoodreads(text: string): GoodreadsBook[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  const at = { title: col("Title"), author: col("Author"), isbn: col("ISBN"), isbn13: col("ISBN13"), rating: col("My Rating"), review: col("My Review"), read: col("Date Read"), shelf: col("Exclusive Shelf") };
  if (at.title < 0) throw new Error("This doesn't look like a Goodreads export (no Title column).");
  const get = (r: string[], i: number) => (i < 0 ? "" : (r[i] ?? "").trim());
  return rows
    .map((r, key) => {
      const rating = Number(get(r, at.rating));
      const dateRead = toIso(get(r, at.read));
      const isbn10 = cleanIsbn(get(r, at.isbn));
      return {
        key,
        title: get(r, at.title),
        author: get(r, at.author),
        isbn: cleanIsbn(get(r, at.isbn13)) ?? isbn10,
        isbn10,
        shelf: get(r, at.shelf) || "read",
        rating: rating >= 1 && rating <= 5 ? rating : null,
        // Goodreads reviews contain <br/> line breaks.
        review: get(r, at.review).replace(/<br\s*\/?>/gi, "\n").trim() || null,
        dateRead,
        year: dateRead?.slice(0, 4) ?? null,
      };
    })
    .filter((b) => b.title);
}

// Shelf mapping (kept deliberately simple):
//   read              → finished (finished_at = Date Read)
//   currently-reading → reading
//   to-read           → shown unchecked; if the reader ticks it, it comes in as "reading"
//                       with no start date (Endpaper has no "want to read" state).
//   any custom shelf  → reading
export const statusFor = (shelf: string): Status => (shelf === "read" ? "finished" : "reading");
export const checkedByDefault = (b: GoodreadsBook) => b.shelf !== "to-read";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(.*?\)/g, "") // Goodreads appends "(Series, #1)"
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export const titleKey = (title: string, author: string) => `${norm(title)}|${norm(author)}`;

/** True when the book is already in the library (same ISBN, or same title + author). */
export function isDuplicate(b: GoodreadsBook, existing: Pick<Book, "title" | "author" | "isbn">[]) {
  const key = titleKey(b.title, b.author);
  return existing.some((e) => {
    const isbn = cleanIsbn(e.isbn ?? "");
    return (isbn && (isbn === b.isbn || isbn === b.isbn10)) || titleKey(e.title, e.author) === key;
  });
}
