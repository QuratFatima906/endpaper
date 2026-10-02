import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicEssay, PublicFooter, PublicFrame, PublicHeader, paragraphs } from "@/components/public-book";
import { ReportLink } from "@/components/report-link";
import { getBook, getEssay, getMood, getReflection } from "../../data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ username: string; slug: string }> };

async function load(params: Props["params"]) {
  const { username, slug } = await params;
  const { profile, book } = await getBook(username, slug);
  const essay = await getEssay(book.id);
  if (!essay) notFound(); // draft or taken down (R-PUB-9)
  return { profile, book, essay };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { profile, book, essay } = await load(params);
  const title = essay.title || `On ${book.title}`;
  const description = (paragraphs(essay.body)[0] ?? "").slice(0, 200) || `An essay on ${book.title} by @${profile.username}.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "article", publishedTime: essay.published_at, authors: [profile.display_name || `@${profile.username}`] },
    robots: book.visibility === "unlisted" ? { index: false, follow: false } : undefined,
  };
}

export default async function PublicEssayPage({ params }: Props) {
  const { profile, book, essay } = await load(params);
  const [r, mood] = await Promise.all([getReflection(book.id, book.share), getMood(book.id, book.share)]);
  return (
    <PublicFrame>
      <PublicHeader back={{ href: `/@${profile.username}`, label: `@${profile.username}` }} />
      <main className="flex-1 pt-8 md:pt-[60px]">
        <PublicEssay
          data={{
            author: profile.display_name || `@${profile.username}`,
            book,
            title: essay.title,
            body: essay.body,
            published_at: essay.published_at,
            verdict: r?.verdict ?? null,
            mood,
          }}
        />
      </main>
      <PublicFooter>
        <ReportLink />
      </PublicFooter>
    </PublicFrame>
  );
}
