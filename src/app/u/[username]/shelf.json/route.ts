import { getProfile, getShelf } from "../data";

// The public shelf as data, at /@username/shelf.json, so another site can show it.
// Same rows as the profile page: visibility = 'public' only, never unlisted.
// status and verdict are stable keys, not labels: labels may change, the feed must not.
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const p = await getProfile((await params).username);
  const { books, verdicts } = await getShelf(p.id);
  const origin = new URL(req.url).origin;

  return Response.json(
    {
      profile: `${origin}/@${p.username}`,
      books: books.map((b) => ({
        title: b.title,
        author: b.author,
        status: b.status,
        verdict: verdicts.get(b.id) ?? null,
        url: `${origin}/@${p.username}/${b.slug}`,
        updatedAt: b.updated_at,
      })),
    },
    // No CDN cache: a book made private must drop out at once, same as the profile page.
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } },
  );
}
