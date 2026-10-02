"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useId, useState } from "react";
import { db } from "@/lib/db";
import { MOODS } from "@/lib/marks";
import { addCheckin } from "@/lib/repo";
import { Button, Chip, Eyebrow, Sheet, TextArea, TextField } from "@/components/ui";

/** Understanding slider: a native range drawn as a pencil line with an accent fill. */
function Understanding({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const id = useId();
  const end = 13 + ((value - 1) / 4) * 316; // thumb centre in the 342-wide viewBox
  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id}>
          <Eyebrow>Understanding so far</Eyebrow>
        </label>
        <span className="font-hand text-lg text-accent" aria-hidden="true">
          {value} of 5
        </span>
      </div>
      <div className="relative h-7">
        <svg width="100%" height="8" viewBox="0 0 342 8" preserveAspectRatio="none" className="rough absolute top-[10px] left-0" aria-hidden="true">
          <path d="M3 4 C 80 3, 180 5, 339 4" fill="none" stroke="var(--rule)" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={`M3 4 C ${end * 0.25} 3, ${end * 0.55} 5, ${end} 4`} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <input
          id={id}
          type="range"
          min={1}
          max={5}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuetext={`${value} of 5`}
          className="relative h-7 w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:size-[26px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-accent [&::-moz-range-thumb]:bg-surface [&::-webkit-slider-thumb]:size-[26px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-solid [&::-webkit-slider-thumb]:border-accent [&::-webkit-slider-thumb]:bg-surface"
        />
      </div>
      <div className="flex justify-between text-xs text-muted" aria-hidden="true">
        <span>Lost</span>
        <span>Clear</span>
      </div>
    </div>
  );
}

export function CheckinSheet({ bookId, open, onClose }: { bookId: string; open: boolean; onClose: () => void }) {
  const book = useLiveQuery(() => db.books.get(bookId), [bookId]);
  const [mood, setMood] = useState("");
  const [understanding, setUnderstanding] = useState(3);
  const [minutes, setMinutes] = useState("");
  const [pages, setPages] = useState("");
  const [text, setText] = useState("");

  function close() {
    setMood("");
    setUnderstanding(3);
    setMinutes("");
    setPages("");
    setText("");
    onClose();
  }

  async function save() {
    const m = parseInt(minutes, 10);
    await addCheckin({ book_id: bookId, mood, understanding, minutes: Number.isFinite(m) && m > 0 ? m : null, pages: pages.trim(), text: text.trim() });
    close();
  }

  return (
    <Sheet open={open} onClose={close} title="Reading check-in">
      <div className="flex flex-col gap-[6px]">
        <h2 className="font-serif text-[28px] leading-[1.1] md:text-[30px]">How was that sitting?</h2>
        {book && <p className="text-[13px] text-muted">{book.title}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Minutes (optional)" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} />
        <TextField label="Pages (optional)" placeholder="e.g. 40–62" value={pages} onChange={(e) => setPages(e.target.value)} />
      </div>
      <div className="flex flex-col gap-3" role="group" aria-labelledby="checkin-mood">
        <Eyebrow>
          <span id="checkin-mood">Mood</span>
        </Eyebrow>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <Chip key={m} selected={mood === m} onClick={() => setMood(mood === m ? "" : m)}>
              {m}
            </Chip>
          ))}
        </div>
      </div>
      <Understanding value={understanding} onChange={setUnderstanding} />
      <TextArea hand aria-label="Anything else" placeholder="anything on your mind? (optional)" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex flex-col gap-3 md:flex-row md:justify-end">
        <div className="hidden md:block">
          <Button variant="outline" size="md" onClick={close}>
            Skip
          </Button>
        </div>
        <Button onClick={save}>
          Save check-in
        </Button>
      </div>
    </Sheet>
  );
}
