import Link from "next/link";
import type { ReactNode } from "react";
import { Cover, Eyebrow, Logo, MarginNote, MarkGlyph, Rule, cx } from "@/components/ui";
import { VERDICTS } from "@/lib/marks";
import type { Book, Mark, PageItem, Reflection, Verdict } from "@/lib/types";

// Presentational views of shared content. Plain data in, no data access: the public
// server pages feed them Supabase rows (RLS-filtered) and /preview feeds them local rows
// filtered by the same rules. Only passage TEXT ever reaches here, never photos (R-PUB-10).

export type MoodPoint = { created_at: string; mood: string; understanding: number; pages?: string };
export type PublicBookData = {
  username: string;
  book: Pick<Book, "id" | "title" | "author" | "cover_url" | "status" | "finished_at">;
  reflection: Pick<Reflection, "takeaway" | "understood" | "unsure" | "recommend" | "verdict"> | null;
  passages: { id: string; text: string; page: string; mark: Mark | null; note: string }[];
  words: { id: string; word: string; definition: string }[];
  pages: { id: string; items: PageItem[] }[];
  mood: MoodPoint[];
  essay: { title: string; href: string } | null;
};
export type PublicEssayData = {
  author: string; // display name or @username
  book: Pick<Book, "title" | "author">;
  title: string;
  body: string;
  published_at: string | null;
  verdict: Verdict | null;
  mood: MoodPoint[];
};

const monthYear = (d: string) => new Date(d).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
export const longDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export const paragraphs = (s: string) => s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

export function readingLine(b: PublicBookData["book"]) {
  const when = b.status === "finished" ? (b.finished_at ? `Finished ${monthYear(b.finished_at)}` : "Finished") : b.status === "reading" ? "Reading now" : b.status === "shelf" ? "On the shelf" : "Set aside";
  return [b.author, when].filter(Boolean).join(" · ");
}

/** The three verdicts with the chosen one circled in pencil. */
export function VerdictLine({ verdict, className }: { verdict: Verdict | null; className?: string }) {
  if (!verdict) return null;
  const label = VERDICTS.find((v) => v.id === verdict)?.label;
  return (
    <div className={cx("font-serif text-[22px]", className)}>
      <p className="sr-only">Verdict: {label}</p>
      <div aria-hidden="true" className="flex flex-wrap gap-x-[26px] gap-y-2 pl-[6px]">
        {VERDICTS.map((v) =>
          v.id === verdict ? (
            <span key={v.id} className="relative text-accent">
              {v.label}
              <svg viewBox="0 0 86 48" preserveAspectRatio="none" className="rough absolute -top-[9px] -left-4 h-12 w-[calc(100%+32px)]">
                <path d="M50 5 C 20 2, 3 12, 5 25 C 8 42, 70 45, 81 27 C 88 14, 66 3, 38 7" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
            </span>
          ) : (
            <span key={v.id} className="text-muted">
              {v.label}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

/** Catmull-Rom through the points, as cubic Béziers: a hand-drawn curve, not a chart. */
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1] ?? pts[i], pts[i], pts[i + 1], pts[i + 2] ?? pts[i + 1]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/** Understanding (1–5) across sittings as one pencil line, drawn once (spec §2.4). */
export function MoodLine({ points }: { points: MoodPoint[] }) {
  if (!points.length) return null;
  const w = 1000;
  const h = 80;
  const xs = points.map((_, i) => (points.length === 1 ? w / 2 : 4 + (i * (w - 8)) / (points.length - 1)));
  const ys = points.map((p) => 8 + ((5 - Math.min(5, Math.max(1, p.understanding))) / 4) * (h - 16));
  const low = ys.indexOf(Math.max(...ys));
  const lowPoint = points[low];
  const note = points.length > 2 ? [lowPoint.pages?.trim(), lowPoint.mood.toLowerCase()].filter(Boolean).join(" · ") : "";
  const label = `How it felt, across ${points.length} ${points.length === 1 ? "sitting" : "sittings"}`;
  return (
    <figure className="m-0 flex flex-col gap-3">
      <figcaption className="text-[13px] text-muted">{label}</figcaption>
      <div className="relative">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="rough block h-[64px] w-full md:h-[80px]" role="img" aria-label={`Understanding over time; moods: ${points.map((p) => p.mood).join(", ")}`}>
          <path d={smoothPath(xs.map((x, i) => [x, ys[i]]))} fill="none" stroke="var(--muted)" strokeWidth="1.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {points.length === 1 && <circle cx={xs[0]} cy={ys[0]} r="3" fill="var(--muted)" />}
        </svg>
        {note && (
          <p aria-hidden="true" className="absolute top-full mt-1 -translate-x-1/2 font-hand text-sm whitespace-nowrap text-accent" style={{ left: `clamp(60px, ${(xs[low] / w) * 100}%, calc(100% - 60px))` }}>
            {note}
          </p>
        )}
      </div>
    </figure>
  );
}

/** Readers often type the quote marks themselves; draw our own exactly once. */
export const unquote = (t: string) => t.trim().replace(/^["“”'‘’«]+|["“”'‘’»]+$/g, "").trim();
/** "212" → "p. 212"; "ch. 7" or "Ch. 22" stays as typed. */
export const pageLabel = (page: string) => (/^\d/.test(page.trim()) ? `p. ${page.trim()}` : page.trim());

/** Cover photo tipped in with translucent paper photo-corners. */
function TippedCover({ book }: { book: PublicBookData["book"] }) {
  // Drop-shadow sits on the wrapper because clip-path would cut a box-shadow off.
  const corner = (pos: string, clip: string) => (
    <span aria-hidden="true" className={cx("absolute h-9 w-9 drop-shadow-[0_1px_1.5px_rgba(27,29,34,.22)]", pos)}>
      <span className={cx("block h-full w-full bg-[rgba(244,242,236,.82)]", clip)} />
    </span>
  );
  return (
    <div className="relative w-[150px] -rotate-[1.6deg] md:w-[220px]">
      <div className="bg-white p-[7px] shadow-[0_2px_3px_rgba(27,29,34,.08),0_14px_28px_-10px_var(--shadow)] md:p-[9px]">
        <Cover book={book} className={cx("!p-0", book.cover_url && "[&>div]:hidden [&>img]:inset-0 [&>img]:h-full [&>img]:w-full")} />
      </div>
      {corner("-top-3 -left-3", "[clip-path:polygon(0_0,100%_0,0_100%)]")}
      {corner("-top-3 -right-3", "[clip-path:polygon(0_0,100%_0,100%_100%)]")}
      {corner("-bottom-3 -left-3", "[clip-path:polygon(0_0,100%_100%,0_100%)]")}
      {corner("-right-3 -bottom-3", "[clip-path:polygon(100%_0,100%_100%,0_100%)]")}
    </div>
  );
}

/** Section label with a full-width pencil rule underneath. */
function SectionHead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col gap-3", className)}>
      <Eyebrow>{children}</Eyebrow>
      <Rule />
    </div>
  );
}

type SharedPassage = PublicBookData["passages"][number];
// The reader's own questions and objections read as handwriting, not as quotes.
const isThought = (p: SharedPassage) => p.mark === "confusing" || p.mark === "disagree";

/** ¶ circled in pencil, like the verdict; other marks as plain glyphs. */
function MarkBadge({ mark, size = "lg" }: { mark: SharedPassage["mark"]; size?: "lg" | "sm" }) {
  if (!mark) return null;
  if (mark === "loved" && size === "lg")
    return (
      <span className="relative inline-flex h-8 w-8 items-center justify-center">
        <svg viewBox="0 0 32 32" className="rough absolute inset-0" aria-hidden="true">
          <path d="M18 3 C 7 2, 2 10, 3 18 C 5 28, 24 31, 29 19 C 32 10, 26 3, 14 4" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <MarkGlyph mark={mark} className="relative text-lg" />
      </span>
    );
  return <MarkGlyph mark={mark} className={size === "lg" ? "text-lg" : "text-base"} />;
}

function FeaturedPassage({ p }: { p: SharedPassage }) {
  return (
    <figure className="m-0 flex flex-col gap-3">
      <div className="flex items-center gap-3 text-[13px] text-muted">
        <MarkBadge mark={p.mark} />
        {p.page && pageLabel(p.page)}
      </div>
      <blockquote className={cx("m-0 [text-wrap:pretty]", isThought(p) ? "font-hand text-[22px] leading-[1.35] text-accent md:text-[26px]" : "font-serif text-[26px] leading-[1.25] md:text-[32px]")}>
        {isThought(p) ? unquote(p.text) : `“${unquote(p.text)}”`}
      </blockquote>
      {p.note.trim() && <MarginNote>{p.note.trim()}</MarginNote>}
    </figure>
  );
}

function SmallPassage({ p }: { p: SharedPassage }) {
  return (
    <figure className="m-0 flex gap-3">
      <span className="w-4 flex-none pt-[2px]">
        <MarkBadge mark={p.mark} size="sm" />
      </span>
      <div className="flex flex-col gap-2">
        <blockquote className={cx("m-0 [text-wrap:pretty]", isThought(p) ? "font-hand text-[17px] leading-[1.4] text-accent" : "font-serif text-lg leading-[1.45]")}>
          {isThought(p) ? unquote(p.text) : `“${unquote(p.text)}”`}
        </blockquote>
        {p.note.trim() && <p className="font-hand text-[15px] leading-[1.4] text-accent">{p.note.trim()}</p>}
        {p.page && <p className="text-xs text-muted">{pageLabel(p.page)}</p>}
      </div>
    </figure>
  );
}

/** Loved first, then key points; up to two get the big treatment. */
function splitPassages(passages: SharedPassage[]) {
  const rank = (p: SharedPassage) => (p.mark === "loved" ? 0 : p.mark === "key" ? 1 : 2);
  const featured = passages.length <= 2 ? passages : [...passages].filter((p) => rank(p) < 2).sort((a, b) => rank(a) - rank(b)).slice(0, 2);
  return { featured, rest: passages.filter((p) => !featured.includes(p)) };
}

export function PublicBook({ data, headingLevel = 1 }: { data: PublicBookData; headingLevel?: 1 | 2 }) {
  const { book, reflection: r, passages, words, pages, mood, essay } = data;
  const H = headingLevel === 1 ? "h1" : "h2";
  const byId = new Map(passages.map((p) => [p.id, p]));
  const pageLists = pages
    .map((pg) => ({ id: pg.id, lines: pg.items.map((it) => (it.kind === "text" ? it.text?.trim() : it.kind === "passage" && it.passage_id ? byId.get(it.passage_id)?.text : undefined)).filter((t): t is string => !!t) }))
    .filter((pg) => pg.lines.length);
  const { featured, rest } = splitPassages(passages);
  // "What I understood", one point per line, reads as the book's key points.
  const points = r ? r.understood.split(/\n+/).map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim()).filter(Boolean) : [];
  const closing = r
    ? ([
        ["Still unsure about", r.unsure],
        ["Who I'd give it to", r.recommend],
      ] as const).filter(([, v]) => v.trim())
    : [];

  return (
    <article className="flex flex-col gap-16 md:gap-20">
      {/* Hero */}
      <header className="flex flex-col gap-8 md:flex-row md:items-start md:gap-[88px]">
        <div className="flex-none pt-2 pl-2">
          <TippedCover book={book} />
        </div>
        <div className="flex min-w-0 flex-col gap-5 md:pt-6">
          <H className="m-0 font-serif text-[40px] leading-[1.02] font-normal tracking-[-.01em] [text-wrap:balance] md:text-[64px]">{book.title}</H>
          <p className="text-sm text-muted md:text-[15px]">{readingLine(book)}</p>
          {r && <VerdictLine verdict={r.verdict} className="mt-2 md:text-2xl" />}
          {r?.takeaway.trim() && <p className="mt-2 max-w-[640px] font-serif text-2xl leading-[1.35] italic [text-wrap:pretty] md:text-[30px]">{r.takeaway.trim()}</p>}
          {essay && (
            <Link href={essay.href} className="font-serif text-xl text-accent underline">
              Read the essay{essay.title ? `: ${essay.title}` : ""}
            </Link>
          )}
        </div>
      </header>

      {/* Passages */}
      {passages.length > 0 && (
        <section aria-label="Passages" className="flex flex-col gap-10">
          <SectionHead>Passages</SectionHead>
          {featured.length > 0 && (
            <div className="grid gap-12 md:grid-cols-2 md:gap-16">
              {featured.map((p) => (
                <FeaturedPassage key={p.id} p={p} />
              ))}
            </div>
          )}
          {rest.length > 0 && (
            <div className="grid gap-8 md:grid-cols-3 md:gap-x-12 md:gap-y-10">
              {rest.map((p) => (
                <SmallPassage key={p.id} p={p} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Key points + words */}
      {(points.length > 0 || words.length > 0) && (
        <div className="grid gap-14 md:grid-cols-[minmax(0,1fr)_minmax(0,380px)] md:gap-20">
          {points.length > 0 ? (
            <section aria-label="Key points" className="flex flex-col gap-8">
              <SectionHead>Key points</SectionHead>
              <ol className="m-0 flex list-none flex-col gap-5 p-0">
                {points.map((pt, i) => (
                  <li key={i} className="flex gap-4 font-serif text-lg leading-[1.5] md:text-xl">
                    <span className="w-5 flex-none font-serif text-accent italic">{i + 1}</span>
                    <span className="[text-wrap:pretty]">{pt}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : (
            <div className="hidden md:block" />
          )}
          {words.length > 0 && (
            <section aria-label="Words" className="relative rotate-[-0.8deg] self-start bg-white px-7 pt-8 pb-7 text-[#1b1d22] shadow-[0_2px_3px_rgba(27,29,34,.08),0_14px_28px_-12px_var(--shadow)] md:mt-6">
              <span aria-hidden="true" className="rough-big absolute -top-3 right-10 h-7 w-24 rotate-[-3deg]" style={{ background: "var(--tape)" }} />
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-lg text-[#2a4bb5] italic" aria-hidden="true">
                  g.
                </span>
                <span className="text-xs font-medium tracking-[.08em] text-[#5b606a] uppercase">Words</span>
              </div>
              <dl className="m-0 mt-4 flex flex-col gap-4">
                {words.map((w) => (
                  <div key={w.id} className="flex flex-col gap-[2px]">
                    <dt className="font-serif text-xl italic">{w.word}</dt>
                    {w.definition && <dd className="m-0 font-hand text-base leading-[1.35] text-[#2a4bb5]">{w.definition}</dd>}
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      )}

      {/* Closing reflection */}
      {closing.length > 0 && (
        <section aria-label="Reflection" className="flex flex-col gap-8">
          <SectionHead>Reflection</SectionHead>
          <div className="grid gap-10 md:grid-cols-2 md:gap-16">
            {closing.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-2">
                <h3 className="m-0 text-[13px] font-normal text-muted">{label}</h3>
                {paragraphs(value).map((p, i) => (
                  <p key={i} className="font-serif text-lg leading-[1.55] [text-wrap:pretty] md:text-xl">
                    {p}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {pageLists.length > 0 && (
        <section aria-label="Pages" className="flex flex-col gap-8">
          <SectionHead>Pages</SectionHead>
          {pageLists.map((pg, i) => (
            <div key={pg.id} className="flex flex-col gap-2">
              <p className="text-[13px] text-muted">Page {i + 1}</p>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {pg.lines.map((t, j) => (
                  <li key={j} className="font-serif text-[17px] leading-[1.5]">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {mood.length > 0 && (
        <div className="pb-6">
          <MoodLine points={mood} />
        </div>
      )}
    </article>
  );
}

export function PublicEssay({ data, headingLevel = 1 }: { data: PublicEssayData; headingLevel?: 1 | 2 }) {
  const H = headingLevel === 1 ? "h1" : "h2";
  return (
    <article className="mx-auto flex max-w-[640px] flex-col">
      <p className="text-sm text-muted">
        {data.author}
        {data.published_at && ` · ${longDate(data.published_at)}`} · on <cite className="font-serif text-base">{data.book.title}</cite>
        {data.book.author && `, ${data.book.author}`}
      </p>
      <H className="mt-[18px] mb-0 font-serif text-[40px] leading-[1.05] font-normal tracking-[-.01em] [text-wrap:pretty] md:text-[60px]">{data.title || "Untitled"}</H>
      <svg width="220" height="12" viewBox="0 0 220 12" className="rough mt-[18px]" aria-hidden="true">
        <path d="M3 8 C 60 3, 130 10, 216 4" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <div className="mt-[34px] flex flex-col gap-5">
        {paragraphs(data.body).map((p, i) => (
          <p key={i} className="font-serif text-lg leading-[1.65] whitespace-pre-line [text-wrap:pretty] md:text-[21px]">
            {p}
          </p>
        ))}
      </div>
      {data.verdict && (
        <div className="mt-11 flex flex-col gap-[10px]">
          <Eyebrow>Verdict</Eyebrow>
          <VerdictLine verdict={data.verdict} className="md:text-2xl" />
        </div>
      )}
      {data.mood.length > 0 && (
        <div className="mt-11">
          <MoodLine points={data.mood} />
        </div>
      )}
    </article>
  );
}

/** Top bar of public pages: back to the profile (if any) and an invitation to start. */
export function PublicHeader({ back }: { back?: { href: string; label: string } }) {
  return (
    <header className="flex items-center justify-between py-5 text-sm md:py-7">
      {back ? (
        <Link href={back.href} className="inline-flex min-h-11 items-center">
          ← {back.label}
        </Link>
      ) : (
        <Link href="/" aria-label="Endpaper home" className="inline-flex min-h-11 items-center">
          <Logo />
        </Link>
      )}
      <Link href="/" className="inline-flex min-h-11 items-center">
        Start your own
      </Link>
    </header>
  );
}

export function PublicFooter({ children }: { children?: ReactNode }) {
  return (
    <footer className="mt-20 flex items-center justify-between gap-4 pb-7 text-[13px] text-muted">
      <Link href="/" className="inline-flex min-h-11 items-center gap-2">
        <Logo size={12} word={false} />
        Made with Endpaper
      </Link>
      {children}
    </footer>
  );
}

/** Frame for public pages: desktop-first width, phone gutters. */
export function PublicFrame({ children }: { children: ReactNode }) {
  return <div className="relative z-[1] mx-auto flex min-h-dvh w-full max-w-[1280px] flex-col px-6 md:px-16">{children}</div>;
}
