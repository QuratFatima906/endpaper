"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * Local edit buffer over a live IndexedDB value. Edits are saved after `delay` ms of quiet
 * (and flushed on unmount); once the stored value catches up the buffer is dropped, so
 * changes from elsewhere (OCR, another tab, sync) show through while you're not typing.
 */
export function useDraft<T>(value: T, save: (v: T) => unknown, delay = 400) {
  const [draft, setDraft] = useState<{ v: T } | null>(null);
  const pending = useRef<{ v: T; save: (v: T) => unknown } | null>(null);

  useEffect(() => {
    if (!draft) return;
    pending.current = { v: draft.v, save };
    const t = setTimeout(() => {
      pending.current = null;
      void save(draft.v);
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save is re-created each render; the latest one is captured with the draft
  }, [draft]);

  useEffect(() => {
    const flush = () => {
      if (pending.current) void pending.current.save(pending.current.v);
      pending.current = null;
    };
    addEventListener("pagehide", flush);
    return () => {
      removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  if (draft && same(draft.v, value)) setDraft(null);
  return [draft ? draft.v : value, (v: T) => setDraft({ v })] as const;
}

/**
 * Renders into <body>: fixed bars (BottomAction) inside the `.page-in` section would otherwise
 * be positioned against the animating transform and jump mid page-turn.
 */
export function Portal({ children }: { children: ReactNode }) {
  return typeof document === "undefined" ? null : createPortal(children, document.body);
}
