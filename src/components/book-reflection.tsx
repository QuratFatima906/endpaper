"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useId } from "react";
import { db } from "@/lib/db";
import { VERDICTS } from "@/lib/marks";
import { saveReflection } from "@/lib/repo";
import type { Checkin, Reflection } from "@/lib/types";
import { BottomAction, ButtonLink, Eyebrow, Rule, SavedHint } from "@/components/ui";
import { cx } from "@/lib/cx";
import { Portal, useDraft } from "@/components/book-draft";

type Field = "takeaway" | "understood" | "unsure" | "recommend";

function Line({ bookId, field, label, value, big }: { bookId: string; field: Field; label: string; value: string; big?: boolean }) {
  const id = useId();
  const [v, setV] = useDraft(value, (t) => saveReflection(bookId, { [field]: t }));
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id}>
        <Eyebrow>{label}</Eyebrow>
      </label>
      <textarea
        id={id}
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Write a line…"
        rows={1}
        className={cx(
          "block w-full resize-none bg-transparent font-serif outline-none [field-sizing:content] text-pretty",
          big ? "text-2xl leading-[1.3] italic md:text-[32px]" : "text-[17px] leading-[1.45] md:text-[19px] md:leading-[1.55]",
        )}
      />
    </div>
  );
}

const RATINGS = [
  { id: "ideas", label: "Ideas" },
  { id: "writing", label: "Writing" },
  { id: "reread", label: "Re-read value" },
] as const;

function Dots({ bookId, ratings }: { bookId: string; ratings: Reflection["ratings"] }) {
  return (
    <div className="flex flex-col gap-1">
      {RATINGS.map((r) => {
        const cur = ratings[r.id] ?? 0;
        return (
          <div key={r.id} role="group" aria-label={`${r.label}, ${cur ? `${cur} of 5` : "not rated"}`} className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted" aria-hidden="true">
              {r.label}
            </span>
            <span className="flex">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${r.label} ${n} of 5`}
                  aria-pressed={cur === n}
                  onClick={() => saveReflection(bookId, { ratings: { ...ratings, [r.id]: cur === n ? undefined : n } })}
                  className="flex size-11 items-center justify-center"
                >
                  <span className={cx("rough size-[10px] rounded-full border-[1.5px]", n <= cur ? "border-ink bg-ink" : "border-field")} />
                </button>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** The check-in "mood line": understanding over time, drawn once, in pencil. */
function MoodLine({ checkins }: { checkins: Checkin[] }) {
  const n = checkins.length;
  const pts = checkins.map((c, i) => [2 + (i / (n - 1)) * 338, 40 - ((Math.min(5, Math.max(1, c.understanding)) - 1) / 4) * 36] as const);
  const d = pts.map(([x, y], i) => {
    if (i === 0) return `M${x} ${y}`;
    const [px, py] = pts[i - 1];
    const mx = (px + x) / 2;
    return `C${mx} ${py}, ${mx} ${y}, ${x} ${y}`;
  });
  const first = checkins[0].understanding;
  const last = checkins[n - 1].understanding;
  const summary = `Understanding across ${n} sittings: started at ${first} of 5, now ${last} of 5.`;
  return (
    <figure className="m-0 flex flex-col gap-2">
      <figcaption className="text-[13px] text-muted">How it felt, across {n} sittings</figcaption>
      <svg width="100%" height="48" viewBox="0 0 342 44" preserveAspectRatio="none" className="rough" role="img" aria-label={summary}>
        <path d={d.join(" ")} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </figure>
  );
}

export function BookReflection({ bookId }: { bookId: string }) {
  const r = useLiveQuery(async () => (await db.reflections.get(bookId)) ?? null, [bookId]);
  const checkins = useLiveQuery(() => db.checkins.where("book_id").equals(bookId).filter((c) => !c.deleted_at).sortBy("created_at"), [bookId]);
  if (r === undefined) return null;
  const rf = r && !r.deleted_at ? r : null;

  return (
    <>
      <h2 className="sr-only">Reflection</h2>
      <div className="mt-[26px] grid gap-8 md:mt-[34px] md:grid-cols-[1fr_320px] md:gap-20">
        <div className="flex max-w-[640px] flex-col gap-[22px] md:gap-6">
          <div className="-mb-3 flex justify-end md:hidden">
            <SavedHint at={rf?.updated_at} />
          </div>
          <Line bookId={bookId} field="takeaway" label="In one sentence" value={rf?.takeaway ?? ""} big />
          <Line bookId={bookId} field="understood" label="What I understood" value={rf?.understood ?? ""} />
          <Line bookId={bookId} field="unsure" label="Still unsure about" value={rf?.unsure ?? ""} />
          <Line bookId={bookId} field="recommend" label="Who I'd give it to" value={rf?.recommend ?? ""} />
        </div>

        <div className="flex flex-col gap-4">
          <div className="hidden md:block">
            <SavedHint at={rf?.updated_at} />
          </div>
          <div className="flex flex-col gap-[14px]" role="group" aria-labelledby="verdict-label">
            <Eyebrow>
              <span id="verdict-label">Verdict</span>
            </Eyebrow>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pl-[6px] font-serif text-xl md:gap-x-7 md:text-[22px]">
              {VERDICTS.map((v) => {
                const on = rf?.verdict === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => saveReflection(bookId, { verdict: on ? null : v.id })}
                    className={cx("relative min-h-11 whitespace-nowrap", on ? "text-accent" : "text-muted hover:text-ink")}
                  >
                    {v.label}
                    {on && (
                      <svg viewBox="0 0 86 48" preserveAspectRatio="none" className="rough pointer-events-none absolute -top-[2px] -left-4 h-12 w-[calc(100%+32px)]" aria-hidden="true">
                        <path d="M50 5 C 20 2, 3 12, 5 25 C 8 42, 70 45, 81 27 C 88 14, 66 3, 38 7" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <Dots bookId={bookId} ratings={rf?.ratings ?? {}} />
          {checkins && checkins.length >= 2 && (
            <>
              <Rule className="mt-2" />
              <MoodLine checkins={checkins} />
            </>
          )}
          <div className="mt-2 hidden md:block">
            <ButtonLink href={`/essay?id=${bookId}`} variant="outline" size="md">
              Turn into an essay
            </ButtonLink>
          </div>
        </div>
      </div>
      <Portal>
        <BottomAction>
        <ButtonLink href={`/essay?id=${bookId}`} variant="outline" className="bg-paper">
          Turn into an essay
        </ButtonLink>
      </BottomAction>
      </Portal>
    </>
  );
}
