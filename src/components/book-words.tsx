"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db } from "@/lib/db";
import { addWord, patch, remove } from "@/lib/repo";
import type { Word } from "@/lib/types";
import { BottomAction, Button, Empty, Rule, TextArea, TextField } from "@/components/ui";
import { Portal, useDraft } from "@/components/book-draft";

function WordEditor({ w, onDone }: { w: Word; onDone: () => void }) {
  const save = (k: "word" | "definition" | "page") => (v: string) => patch<Word>("words", w.id, { [k]: v });
  const [word, setWord] = useDraft(w.word, save("word"));
  const [definition, setDefinition] = useDraft(w.definition, save("definition"));
  const [page, setPage] = useDraft(w.page, save("page"));
  return (
    <div className="flex flex-col gap-4">
      <TextField label="Word" value={word} onChange={(e) => setWord(e.target.value)} autoFocus={!w.word} />
      <TextArea label="Definition" hand placeholder="what it means, in your words" value={definition} onChange={(e) => setDefinition(e.target.value)} />
      <TextField label="Page" value={page} onChange={(e) => setPage(e.target.value)} className="max-w-[200px]" />
      <div className="flex items-center gap-6">
        <Button size="md" variant="outline" onClick={onDone}>
          Done
        </Button>
        <button type="button" className="min-h-11 text-sm underline" onClick={() => remove("words", w.id).then(onDone)}>
          Delete word
        </button>
      </div>
    </div>
  );
}

export function BookWords({ bookId }: { bookId: string }) {
  const words = useLiveQuery(
    () => db.words.where("book_id").equals(bookId).filter((w) => !w.deleted_at).sortBy("created_at"),
    [bookId],
  );
  const [editing, setEditing] = useState<string | null>(null);

  async function add() {
    setEditing(await addWord({ book_id: bookId, word: "" }));
  }

  if (!words) return null;
  return (
    <>
      <h2 className="sr-only">Words</h2>
      {words.length === 0 && (
        <div className="mt-8">
          <Empty>No words yet. Tag a passage g. or add one here.</Empty>
        </div>
      )}
      <ul className="mt-[26px] grid max-w-[1000px] gap-[22px] md:mt-[30px] md:grid-cols-2 md:gap-x-[72px] md:gap-y-7">
        {words.map((w) => (
          <li key={w.id} className="flex flex-col gap-[6px]">
            {editing === w.id ? (
              <WordEditor w={w} onDone={() => setEditing(null)} />
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-4">
                  <button type="button" onClick={() => setEditing(w.id)} className="min-h-11 text-left font-serif text-2xl italic md:text-[28px]">
                    {w.word || <span className="text-muted">New word</span>}
                    <span className="sr-only">, edit</span>
                  </button>
                  {w.passage_id ? (
                    <Link href={`/passage?id=${w.passage_id}`} className="min-h-11 content-center text-xs whitespace-nowrap text-muted hover:text-ink">
                      {w.page ? `p. ${w.page} ` : ""}→<span className="sr-only"> source passage</span>
                    </Link>
                  ) : (
                    w.page && <span className="text-xs text-muted">p. {w.page}</span>
                  )}
                </div>
                {w.definition ? (
                  <p className="-rotate-[0.6deg] font-hand text-[17px] leading-[1.35] text-accent md:text-lg">{w.definition}</p>
                ) : (
                  <button type="button" onClick={() => setEditing(w.id)} className="min-h-11 self-start text-left text-[15px] text-muted">
                    No definition yet<span className="hidden md:inline"> · <span className="text-accent">add one</span></span>
                  </button>
                )}
              </>
            )}
            <Rule soft className="mt-4" />
          </li>
        ))}
      </ul>
      <div className="mt-10 hidden md:block">
        <Button variant="outline" size="md" onClick={add}>
          Add a word
        </Button>
      </div>
      <Portal>
        <BottomAction>
        <Button variant="outline" onClick={add} className="bg-paper">
          Add a word
        </Button>
      </BottomAction>
      </Portal>
    </>
  );
}
