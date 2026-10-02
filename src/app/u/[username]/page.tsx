import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicFrame, PublicHeader, longDate } from "@/components/public-book";
import { ReportLink } from "@/components/report-link";
import { Cover, Eyebrow } from "@/components/ui";
import { VERDICTS } from "@/lib/marks";
import { getProfile, getShelf } from "./data";

// Private → public changes must show up (and vanish) immediately: never cache.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProfile((await params).username);
  const name = p.display_name || `@${p.username}`;
  const description = p.bio || `${name}'s reading shelf on Endpaper.`;
  return { title: name, description, openGraph: { title: name, description, type: "profile", username: p.username } };
}

export default async function PublicProfile({ params }: Props) {
  const p = await getProfile((await params).username);
  const { books, verdicts, essays } = await getShelf(p.id);
  const withEssay = new Set(essays.map((e) => e.book_id));
  const bookOf = new Map(books.map((b) => [b.id, b]));

  return (
    <PublicFrame>
      <PublicHeader />
      <main className="grid flex-1 gap-12 pt-8 md:grid-cols-[320px_1fr] md:gap-20 md:pt-[60px]">
        <div className="flex flex-col gap-[14px]">
          <h1 className="m-0 font-serif text-[40px] leading-none font-normal md:text-5xl">{p.display_name || `@${p.username}`}</h1>
          {p.display_name && <p className="text-sm text-muted">@{p.username}</p>}
          {p.bio && <p className="mt-[6px] font-serif text-lg leading-normal [text-wrap:pretty]">{p.bio}</p>}
          <nav aria-label="Sections" className="mt-4 flex gap-6 text-[15px] md:flex-col md:gap-[10px]">
            <a href="#shelf" className="min-h-11 content-center text-accent">
              Shelf
            </a>
            <a href="#essays" className="min-h-11 content-center text-muted hover:text-ink">
              Essays
            </a>
          </nav>
        </div>

        <div className="flex flex-col gap-16">
          <section id="shelf" aria-labelledby="shelf-h" className="flex flex-col gap-6">
            <h2 id="shelf-h" className="sr-only">
              Shelf
            </h2>
            <p className="text-sm text-muted">{books.length ? `${books.length} ${books.length === 1 ? "book" : "books"} shared` : "Nothing on the shelf yet."}</p>
            {books.length > 0 && (
              <ul className="m-0 grid list-none grid-cols-3 gap-x-[22px] gap-y-7 p-0 sm:grid-cols-4 lg:grid-cols-6">
                {books.map((b) => {
                  const v = VERDICTS.find((x) => x.id === verdicts.get(b.id))?.label;
                  const caption = [v, withEssay.has(b.id) && "essay"].filter(Boolean).join(" · ");
                  return (
                    <li key={b.id}>
                      <Link href={`/@${p.username}/${b.slug}`} aria-label={[b.title, caption].filter(Boolean).join(", ")} className="press flex flex-col gap-2">
                        <Cover book={b} />
                        {caption && <span aria-hidden="true" className="text-[13px] text-muted">{caption}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section id="essays" aria-labelledby="essays-h" className="flex flex-col gap-4">
            <Eyebrow>
              <h2 id="essays-h" className="m-0 text-xs font-medium">
                Essays
              </h2>
            </Eyebrow>
            {essays.length ? (
              <ul className="m-0 flex list-none flex-col gap-5 p-0">
                {essays.map((e) => {
                  const b = bookOf.get(e.book_id)!;
                  return (
                    <li key={e.book_id}>
                      <Link href={`/@${p.username}/${b.slug}/essay`} className="group flex flex-col gap-1">
                        <span className="font-serif text-2xl group-hover:text-accent">{e.title || "Untitled"}</span>
                        <span className="text-[13px] text-muted">
                          on <cite className="font-serif">{b.title}</cite> · {longDate(e.published_at)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">No essays yet.</p>
            )}
          </section>
        </div>
      </main>
      <PublicFooter>
        <ReportLink />
      </PublicFooter>
    </PublicFrame>
  );
}
