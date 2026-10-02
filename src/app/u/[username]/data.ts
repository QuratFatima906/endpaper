import { notFound } from "next/navigation";
import { cache } from "react";
import type { MoodPoint, PublicBookData } from "@/components/public-book";
import { supabaseServer } from "@/lib/supabase";
import type { Book, PageItem, ShareSections, Verdict } from "@/lib/types";

// Server-only reads for the public pages. RLS already hides private rows; we still
// select only the columns a visitor may see. Passage image ids are never selected (R-PUB-10).

type PublicProfile = { id: string; username: string; display_name: string; bio: string };
type PublicBookRow = Pick<Book, "id" | "title" | "author" | "cover_url" | "status" | "finished_at" | "slug" | "visibility" | "description"> & { share: ShareSections };

function client() {
  const sb = supabaseServer();
  if (!sb) notFound(); // device-only mode: nothing is public
  return sb;
}

const must = <T,>(r: { data: T; error: unknown }) => {
  if (r.error) throw r.error;
  return r.data;
};

export const getProfile = cache(async (raw: string): Promise<PublicProfile> => {
  const username = decodeURIComponent(raw).replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(username)) notFound();
  const p = must(await client().from("profiles").select("id,username,display_name,bio").eq("username", username).maybeSingle());
  if (!p) notFound(); // unknown or hidden (RLS)
  return p as PublicProfile;
});

export const getBook = cache(async (raw: string, slug: string) => {
  const profile = await getProfile(raw);
  const book = must(
    await client()
      .from("books")
      .select("id,title,author,cover_url,status,finished_at,slug,visibility,description,share")
      .eq("user_id", profile.id)
      .eq("slug", decodeURIComponent(slug))
      .neq("visibility", "private")
      .is("deleted_at", null)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
  ) as PublicBookRow | null;
  if (!book) notFound();
  return { profile, book };
});

export const getEssay = cache(async (bookId: string) => {
  const e = must(await client().from("essays").select("title,body,published_at").eq("book_id", bookId).is("deleted_at", null).not("published_at", "is", null).maybeSingle());
  return e as { title: string; body: string; published_at: string } | null;
});

export const getReflection = cache(async (bookId: string, share: ShareSections) => {
  if (!share.reflection) return null;
  const r = must(await client().from("reflections").select("takeaway,understood,unsure,recommend,verdict").eq("book_id", bookId).is("deleted_at", null).maybeSingle());
  return r as PublicBookData["reflection"];
});

export const getMood = cache(async (bookId: string, share: ShareSections): Promise<MoodPoint[]> => {
  if (!share.mood) return [];
  return (must(await client().rpc("public_mood_line", { b: bookId })) ?? []) as MoodPoint[];
});

export async function getBookData(raw: string, slug: string): Promise<PublicBookData> {
  const { profile, book } = await getBook(raw, slug);
  const sb = client();
  const s = book.share;
  const none = Promise.resolve({ data: [], error: null });
  const [reflection, passages, words, pages, mood, essay] = await Promise.all([
    getReflection(book.id, s),
    s.passages ? sb.from("passages").select("id,text,page,mark,note").eq("book_id", book.id).eq("hidden", false).is("deleted_at", null).neq("text", "").order("created_at") : none,
    s.words ? sb.from("words").select("id,word,definition").eq("book_id", book.id).is("deleted_at", null).neq("word", "").order("created_at") : none,
    s.pages ? sb.from("pages").select("id,items").eq("book_id", book.id).is("deleted_at", null).order("position") : none,
    getMood(book.id, s),
    getEssay(book.id),
  ]);
  return {
    username: profile.username,
    book,
    reflection,
    passages: must(passages) as PublicBookData["passages"],
    words: must(words) as PublicBookData["words"],
    pages: must(pages) as { id: string; items: PageItem[] }[],
    mood,
    essay: essay ? { title: essay.title, href: `/@${profile.username}/${book.slug}/essay` } : null,
  };
}

/** Public shelf: only visibility = 'public' (unlisted is never listed), plus published essays on those books. */
export async function getShelf(profileId: string) {
  const sb = client();
  const books = must(
    await sb.from("books").select("id,title,cover_url,slug,updated_at").eq("user_id", profileId).eq("visibility", "public").is("deleted_at", null).order("updated_at", { ascending: false }),
  ) as (Pick<Book, "id" | "title" | "cover_url" | "slug" | "updated_at">)[];
  const ids = books.map((b) => b.id);
  if (!ids.length) return { books: [], verdicts: new Map<string, Verdict | null>(), essays: [] };
  const [refl, essays] = await Promise.all([
    sb.from("reflections").select("book_id,verdict").in("book_id", ids).is("deleted_at", null),
    sb.from("essays").select("book_id,title,published_at").in("book_id", ids).is("deleted_at", null).not("published_at", "is", null).order("published_at", { ascending: false }),
  ]);
  return {
    books,
    verdicts: new Map((must(refl) as { book_id: string; verdict: Verdict | null }[]).map((r) => [r.book_id, r.verdict])),
    essays: must(essays) as { book_id: string; title: string; published_at: string }[],
  };
}
