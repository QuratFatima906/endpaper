// Book lookup: Open Library first, Google Books as fallback (R-LIB-4). No API keys needed.

export type BookHit = {
  title: string;
  author: string;
  isbn: string | null;
  cover_url: string | null;
  description: string | null;
  year: number | null;
  source: "openlibrary" | "googlebooks";
};

const cleanIsbn = (s: string) => s.replace(/[^0-9Xx]/g, "").toUpperCase();

async function openLibrary(params: Record<string, string>): Promise<BookHit[]> {
  const q = new URLSearchParams({ ...params, limit: "12", fields: "title,author_name,isbn,cover_i,first_publish_year" });
  const r = await fetch(`https://openlibrary.org/search.json?${q}`);
  if (!r.ok) throw new Error(`Open Library ${r.status}`);
  const j = (await r.json()) as {
    docs: { title: string; author_name?: string[]; isbn?: string[]; cover_i?: number; first_publish_year?: number }[];
  };
  return j.docs.map((d) => ({
    title: d.title,
    author: d.author_name?.join(", ") ?? "",
    isbn: d.isbn?.find((i) => i.length === 13) ?? d.isbn?.[0] ?? null,
    cover_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
    description: null,
    year: d.first_publish_year ?? null,
    source: "openlibrary" as const,
  }));
}

async function googleBooks(q: string): Promise<BookHit[]> {
  const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=12`);
  if (!r.ok) throw new Error(`Google Books ${r.status}`);
  const j = (await r.json()) as {
    items?: {
      volumeInfo: {
        title: string;
        authors?: string[];
        description?: string;
        publishedDate?: string;
        industryIdentifiers?: { type: string; identifier: string }[];
        imageLinks?: { thumbnail?: string };
      };
    }[];
  };
  return (j.items ?? []).map(({ volumeInfo: v }) => ({
    title: v.title,
    author: v.authors?.join(", ") ?? "",
    isbn: v.industryIdentifiers?.find((i) => i.type === "ISBN_13")?.identifier ?? null,
    cover_url: v.imageLinks?.thumbnail?.replace("http://", "https://") ?? null,
    description: v.description ?? null,
    year: v.publishedDate ? parseInt(v.publishedDate) : null,
    source: "googlebooks" as const,
  }));
}

export async function searchBooks(query: string): Promise<BookHit[]> {
  try {
    const hits = await openLibrary({ q: query });
    if (hits.length) return hits;
  } catch {
    /* fall through to Google Books */
  }
  return googleBooks(query);
}

export async function lookupIsbn(raw: string): Promise<BookHit | null> {
  const isbn = cleanIsbn(raw);
  try {
    const [hit] = await openLibrary({ isbn });
    if (hit) return { ...hit, isbn };
  } catch {
    /* fall through */
  }
  const [hit] = await googleBooks(`isbn:${isbn}`);
  return hit ? { ...hit, isbn } : null;
}
