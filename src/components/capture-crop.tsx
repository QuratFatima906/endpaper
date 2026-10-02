"use client";

import { useId, useRef, type KeyboardEvent, type PointerEvent } from "react";

export type Box = { x0: number; y0: number; x1: number; y1: number }; // fractions of the image
export const FULL: Box = { x0: 0.04, y0: 0.04, x1: 0.96, y1: 0.96 };
export const ENHANCE_FILTER = "contrast(1.25) brightness(1.08) saturate(0.9)"; // mirrors prepareImage

const MIN = 0.1;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const CORNERS = [
  { label: "Top-left", x: "x0", y: "y0" },
  { label: "Top-right", x: "x1", y: "y0" },
  { label: "Bottom-left", x: "x0", y: "y1" },
  { label: "Bottom-right", x: "x1", y: "y1" },
] as const;
type Corner = (typeof CORNERS)[number];

function place(b: Box, c: Corner, x: number, y: number): Box {
  const n = { ...b };
  if (c.x === "x0") n.x0 = clamp(x, 0, b.x1 - MIN);
  else n.x1 = clamp(x, b.x0 + MIN, 1);
  if (c.y === "y0") n.y0 = clamp(y, 0, b.y1 - MIN);
  else n.y1 = clamp(y, b.y0 + MIN, 1);
  return n;
}

/** The photo with four draggable (and arrow-key movable) corner handles. */
export function CropBox({ src, box, onChange, enhance }: { src: string; box: Box; onChange: (b: Box) => void; enhance: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pid: number; c: Corner } | null>(null);
  const hint = useId();

  function down(e: PointerEvent<HTMLButtonElement>, c: Corner) {
    if (drag.current) return; // ignore a second finger
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { pid: e.pointerId, c };
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || d.pid !== e.pointerId || !wrap.current) return;
    const r = wrap.current.getBoundingClientRect();
    onChange(place(box, d.c, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height));
  }
  function up(e: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pid === e.pointerId) drag.current = null;
  }
  function key(e: KeyboardEvent<HTMLButtonElement>, c: Corner) {
    const s = e.shiftKey ? 0.1 : 0.02;
    const dx = e.key === "ArrowLeft" ? -s : e.key === "ArrowRight" ? s : 0;
    const dy = e.key === "ArrowUp" ? -s : e.key === "ArrowDown" ? s : 0;
    if (!dx && !dy) return;
    e.preventDefault();
    onChange(place(box, c, box[c.x] + dx, box[c.y] + dy));
  }

  return (
    <div ref={wrap} className="relative inline-block max-w-full select-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Your photo, ready to crop" draggable={false} className="block max-h-[56vh] w-auto max-w-full" style={{ filter: enhance ? ENHANCE_FILTER : undefined }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
        aria-hidden="true"
        className="pointer-events-none absolute border-2 border-accent"
        style={{ left: `${box.x0 * 100}%`, top: `${box.y0 * 100}%`, width: `${(box.x1 - box.x0) * 100}%`, height: `${(box.y1 - box.y0) * 100}%`, boxShadow: "0 0 0 9999px rgba(0,0,0,.45)" }}
      />
      </div>
      <p id={hint} className="sr-only">
        Arrow keys move this corner. Hold Shift for bigger steps.
      </p>
      {CORNERS.map((c) => (
        <button
          key={c.label}
          type="button"
          aria-label={`${c.label} crop corner`}
          aria-describedby={hint}
          onPointerDown={(e) => down(e, c)}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onKeyDown={(e) => key(e, c)}
          className="absolute flex size-11 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center"
          style={{ left: `${box[c.x] * 100}%`, top: `${box[c.y] * 100}%` }}
        >
          <span className="size-[18px] rounded-full border-2 border-accent bg-surface" />
        </button>
      ))}
    </div>
  );
}
