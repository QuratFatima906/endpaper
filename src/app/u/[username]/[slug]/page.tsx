import type { Metadata } from "next";
import { PublicBook, PublicFooter, PublicFrame, PublicHeader } from "@/components/public-book";
import { ReportLink } from "@/components/report-link";
import { getBook, getBookData, getReflection } from "../data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ username: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, slug } = await params;
  const { profile, book } = await getBook(username, slug);
  const r = await getReflection(book.id, book.share);
  const title = `${book.title} · @${profile.username}`;
  const description = r?.takeaway.trim() || `@${profile.username}'s notes on ${book.title}${book.author ? ` by ${book.author}` : ""}.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    // Unlisted = anyone with the link, but not findable (R-PUB-3).
    robots: book.visibility === "unlisted" ? { index: false, follow: false } : undefined,
  };
}

export default async function PublicBookPage({ params }: Props) {
  const { username, slug } = await params;
  const data = await getBookData(username, slug);
  return (
    <PublicFrame>
      <PublicHeader back={{ href: `/@${data.username}`, label: `@${data.username}` }} />
      <main className="flex-1 pt-6 md:pt-10">
        <PublicBook data={data} />
      </main>
      <PublicFooter>
        <ReportLink />
      </PublicFooter>
    </PublicFrame>
  );
}
