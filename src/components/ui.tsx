"use client";

import Link from "next/link";
import { cx } from "@/lib/cx";
import { useLiveQuery } from "dexie-react-hooks";
import { forwardRef, useEffect, useId, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { db } from "@/lib/db";
import { markOf } from "@/lib/marks";
import { useSession } from "@/lib/session";
import { loadImage, useSyncState } from "@/lib/sync";
import type { Book, Mark } from "@/lib/types";



/** SVG filters used by every hand-drawn edge. Rendered once in the root layout. */
export function RoughDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <filter id="rough" x="-5%" y="-20%" width="110%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="4" />
        <feDisplacementMap in="SourceGraphic" scale="1.8" />
      </filter>
      <filter id="roughBig" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency=".02" numOctaves="2" seed="9" />
        <feDisplacementMap in="SourceGraphic" scale="4" />
      </filter>
      <filter id="paper">
        <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix values="0 0 0 0 .2  0 0 0 0 .2  0 0 0 0 .22  0 0 0 .05 0" />
      </filter>
    </svg>
  );
}

export function PaperGrain() {
  return (
    <svg className="paper-grain" aria-hidden="true">
      <rect width="100%" height="100%" filter="url(#paper)" />
    </svg>
  );
}

export function Logo({ size = 16, word = true, className }: { size?: number; word?: boolean; className?: string }) {
  return (
    <span className={cx("btn gap-2", className)}>
      <svg width={size} height={size * 1.25} viewBox="0 0 36 44" className="rough" aria-hidden="true">
        <path d="M2 2 L23 1.5 L34 13 L34.5 42 L2.5 42.5 Z" fill="none" stroke="var(--ink)" strokeWidth={size > 30 ? 1.8 : 2.6} strokeLinejoin="round" />
        <path d="M23 1.5 L23.5 13 L34 13 Z" fill="var(--accent)" stroke="var(--ink)" strokeWidth={size > 30 ? 1.6 : 2.4} strokeLinejoin="round" />
      </svg>
      {word && <span className="font-serif tracking-[-0.02em]" style={{ fontSize: size * 1.3, lineHeight: 1 }}>endpaper</span>}
    </span>
  );
}

/** Wobbly border drawn behind content. Parent must be `relative`. */
export function RoughBorder({ className, radius = 12, color = "var(--field)", width = 1.5, fill }: { className?: string; radius?: number; color?: string; width?: number; fill?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx("rough pointer-events-none absolute inset-0", className)}
      style={{ border: `${width}px solid ${color}`, borderRadius: radius, background: fill }}
    />
  );
}

/** Hand-drawn horizontal rule. */
export function Rule({ className, soft }: { className?: string; soft?: boolean }) {
  return (
    <svg width="100%" height="6" viewBox="0 0 342 6" preserveAspectRatio="none" className={cx("rough block", className)} aria-hidden="true">
      <path d="M1 3 C 70 1.5, 140 4.5, 210 3 S 310 2, 341 3.5" fill="none" stroke={soft ? "var(--rule-soft)" : "var(--rule)"} strokeWidth="1.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Pencil underline for the active tab. */
export function Underline({ className }: { className?: string }) {
  return (
    <svg width="100%" height="8" viewBox="0 0 64 8" preserveAspectRatio="none" className={cx("rough absolute -bottom-[9px] left-0", className)} aria-hidden="true">
      <path d="M2 5 C 20 2, 40 6, 62 3" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ---- Buttons ---------------------------------------------------------------

type BtnProps = { variant?: "primary" | "outline" | "quiet"; size?: "lg" | "md"; className?: string; children: ReactNode };
const btnClass = (variant: BtnProps["variant"], size: BtnProps["size"], className?: string) =>
  cx(
    "btn press relative font-medium select-none disabled:opacity-50 disabled:pointer-events-none",
    size === "md" ? "h-12 px-[26px] rounded-3xl text-[15px]" : "h-[54px] px-7 rounded-[27px] text-[15px]",
    variant === "primary" && "bg-accent text-on-accent",
    variant === "outline" && "text-ink",
    variant === "quiet" && "text-accent",
    className,
  );

export const Button = forwardRef<HTMLButtonElement, BtnProps & Omit<ComponentProps<"button">, "className" | "children">>(function Button(
  { variant = "primary", size = "lg", className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={btnClass(variant, size, className)} {...rest}>
      {variant === "outline" && <RoughBorder radius={27} color="var(--ink)" />}
      <span className="relative">{children}</span>
    </button>
  );
});

export function ButtonLink({ variant = "primary", size = "lg", className, children, href, ...rest }: BtnProps & Omit<ComponentProps<typeof Link>, "className" | "children">) {
  return (
    <Link href={href} className={btnClass(variant, size, className)} {...rest}>
      {variant === "outline" && <RoughBorder radius={27} color="var(--ink)" />}
      <span className="relative">{children}</span>
    </Link>
  );
}

// Tooltips: a short delay for the first one, then instant while moving between neighbours.
let lastTipClose = 0;

/**
 * Hover (mouse), keyboard focus and long-press (touch) tooltip for any button.
 * Spread `trigger` on the button and render `bubble` next to it inside a `relative` wrapper.
 */
export function useTooltip(tip: string | undefined) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [instant, setInstant] = useState(false);
  const [shift, setShift] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ref = useRef<HTMLSpanElement>(null);
  const isOpen = useRef(false); // sync copy so the next trigger sees the close immediately
  useEffect(() => () => clearTimeout(timer.current), []);

  const show = (delay: number) => {
    clearTimeout(timer.current);
    const warm = Date.now() - lastTipClose < 400;
    timer.current = setTimeout(() => {
      // Keep the bubble inside the viewport (triggers near the page edge).
      const r = ref.current?.getBoundingClientRect();
      if (r) setShift((prev) => Math.max(8 - (r.left - prev), 0) + Math.min(window.innerWidth - 8 - (r.right - prev), 0));
      setInstant(warm);
      isOpen.current = true;
      setOpen(true);
    }, warm ? 0 : delay);
  };
  const hide = () => {
    clearTimeout(timer.current);
    if (isOpen.current) lastTipClose = Date.now();
    isOpen.current = false;
    setOpen(false);
  };

  if (!tip) return { trigger: {}, bubble: null };
  const trigger: ComponentProps<"button"> = {
    "aria-describedby": id,
    onPointerEnter: (e) => e.pointerType === "mouse" && show(450),
    onPointerLeave: hide,
    onPointerDown: (e) => (e.pointerType === "mouse" ? hide() : show(500)), // long-press on touch
    onPointerUp: (e) => e.pointerType !== "mouse" && setTimeout(hide, 1500),
    onFocus: (e) => e.currentTarget.matches(":focus-visible") && show(0),
    onBlur: hide,
    onKeyDown: (e) => e.key === "Escape" && hide(),
    onContextMenu: (e) => e.preventDefault(),
  };
  const bubble = (
    <span ref={ref} id={id} role="tooltip" className="tooltip" data-open={open} data-instant={instant} style={{ ["--shift" as string]: `${shift}px` }}>
      {tip}
    </span>
  );
  return { trigger, bubble };
}

/** Rounded selectable chip (moods, marks, filters). `tip` adds a tooltip. */
export function Chip({ selected, children, className, tip, ...rest }: { selected?: boolean; children: ReactNode; className?: string; tip?: string } & Omit<ComponentProps<"button">, "className">) {
  const { trigger, bubble } = useTooltip(tip);
  const button = (
    <button type="button" aria-pressed={selected} className={cx("press relative min-h-11 px-4 py-2 text-sm", selected ? "text-accent" : "text-ink", className)} {...rest} {...trigger}>
      <RoughBorder radius={20} color={selected ? "var(--accent)" : "var(--field)"} width={selected ? 2 : 1.5} fill={selected ? "var(--accent-wash)" : undefined} />
      <span className="relative">{children}</span>
    </button>
  );
  return bubble ? (
    <span className="relative inline-flex">
      {button}
      {bubble}
    </span>
  ) : (
    button
  );
}

// ---- Fields ----------------------------------------------------------------

export function Label({ children, htmlFor, caps }: { children: ReactNode; htmlFor?: string; caps?: boolean }) {
  return (
    <label htmlFor={htmlFor} className={caps ? "text-xs font-medium uppercase tracking-[.06em] text-muted" : "text-[13px] text-muted"}>
      {children}
    </label>
  );
}

export function TextField({ label, hint, error, className, ...rest }: { label?: string; hint?: ReactNode; error?: string | null; className?: string } & ComponentProps<"input">) {
  const id = useId();
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="relative">
        <RoughBorder radius={12} color={error ? "var(--accent)" : "var(--field)"} />
        <input id={id} aria-invalid={!!error} aria-describedby={error || hint ? `${id}-d` : undefined} className="relative h-[52px] w-full bg-transparent px-4 text-base outline-none" {...rest} />
      </div>
      {(error || hint) && (
        <p id={`${id}-d`} className={cx("text-[13px]", error ? "text-accent" : "text-muted")} role={error ? "alert" : undefined}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

/** Textarea that grows with its content. `hand` uses the handwriting font (margin notes only). */
export function TextArea({ label, hand, className, minRows = 2, ...rest }: { label?: string; hand?: boolean; className?: string; minRows?: number } & ComponentProps<"textarea">) {
  const id = useId();
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="relative">
        <RoughBorder radius={12} />
        <textarea
          id={id}
          rows={minRows}
          className={cx("relative block w-full resize-none bg-transparent px-[14px] py-3 outline-none [field-sizing:content]", hand ? "font-hand text-[17px] text-accent" : "text-base")}
          {...rest}
        />
      </div>
    </div>
  );
}

// ---- Navigation ------------------------------------------------------------

export type Tab = { label: string; href?: string; onClick?: () => void; active?: boolean };

/** Section tabs with a pencil underline under the active one. */
export function Tabs({ tabs, label, className }: { tabs: Tab[]; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={className}>
      <div className="flex gap-[22px] overflow-x-auto pb-[10px] text-sm md:gap-[26px] md:text-[15px]">
        {tabs.map((t) => {
          const cls = cx("relative min-h-11 whitespace-nowrap py-3 -my-3", t.active ? "text-accent" : "text-muted hover:text-ink");
          const inner = (
            <>
              {t.label}
              {t.active && <Underline />}
            </>
          );
          return t.href ? (
            <Link key={t.label} href={t.href} className={cls} aria-current={t.active ? "page" : undefined}>
              {inner}
            </Link>
          ) : (
            <button key={t.label} type="button" onClick={t.onClick} className={cls} aria-pressed={t.active}>
              {inner}
            </button>
          );
        })}
      </div>
      <Rule />
    </nav>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center text-sm text-ink md:text-muted md:hover:text-ink">
      ← {children}
    </Link>
  );
}

export function Avatar({ size = 34 }: { size?: number }) {
  const { profile } = useSession();
  const letter = (profile?.display_name || profile?.username || "·").charAt(0).toUpperCase();
  return (
    <Link href="/settings" aria-label="Settings" className="press relative inline-flex items-center justify-center font-serif text-[15px]" style={{ width: Math.max(size, 44), height: Math.max(size, 44) }}>
      <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <RoughBorder radius={999} color="var(--ink)" />
        <span className="relative">{letter}</span>
      </span>
    </Link>
  );
}

/** Quiet sync indicator. Only speaks up when something is waiting or wrong. */
export function SyncNote() {
  const s = useSyncState();
  const text =
    s.status === "offline" ? (s.pending ? `Offline · ${s.pending} waiting to sync` : "Offline") : s.status === "error" ? "Couldn't sync, will retry" : s.status === "syncing" && s.pending ? "Syncing…" : null;
  return (
    <span role="status" aria-live="polite" className="text-xs text-muted">
      {text}
    </span>
  );
}

/** App header: phone shows logo + Search + avatar, desktop adds Library / Inbox / Search. */
export function AppHeader({ active }: { active?: "library" | "inbox" | "search" }) {
  const nav = [
    { id: "library", label: "Library", href: "/library" },
    { id: "inbox", label: "Inbox", href: "/inbox" },
    { id: "search", label: "Search", href: "/search" },
  ] as const;
  return (
    <header className="no-print">
      <div className="flex items-center justify-between pt-[calc(env(safe-area-inset-top)+18px)] md:pt-[22px]">
        <div className="flex items-center gap-11">
          <Link href="/library" aria-label="Endpaper, library">
            <Logo />
          </Link>
          <nav aria-label="Main" className="hidden gap-7 text-sm md:flex">
            {nav.map((n) => (
              <Link key={n.id} href={n.href} aria-current={active === n.id ? "page" : undefined} className={cx("min-h-11 content-center", active === n.id ? "text-accent" : "text-muted hover:text-ink")}>
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <SyncNote />
          <Link href="/search" className="min-h-11 content-center text-sm md:hidden">
            Search
          </Link>
          <Avatar />
        </div>
      </div>
      <Rule soft className="mt-2 hidden md:block" />
    </header>
  );
}

/** Standard page frame: paper, side gutters, max width. */
export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <main className={cx("relative z-[1] mx-auto w-full px-6 pb-32 md:px-10", wide ? "max-w-[1280px]" : "max-w-[720px] md:max-w-[1280px]", className)}>{children}</main>;
}

/** Fixed primary action at the bottom of phone screens (e.g. "Capture a passage"). */
export function BottomAction({ children }: { children: ReactNode }) {
  return <div className="no-print fixed inset-x-6 bottom-[calc(env(safe-area-inset-bottom)+24px)] z-10 flex flex-col md:hidden [&>*]:w-full">{children}</div>;
}

// ---- Scrapbook pieces --------------------------------------------------------

const COVER_STYLES = [
  { bg: "var(--accent-wash)", border: "var(--accent-edge)", fg: "var(--ink)" },
  { bg: "var(--surface)", border: "var(--field)", fg: "var(--ink)" },
  { bg: "var(--accent)", border: undefined, fg: "var(--on-accent)" },
];
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);

/** Book cover: the real cover if we have one, otherwise a hand-cut paper cover. */
export function Cover({ book, className }: { book: Pick<Book, "id" | "title" | "cover_url">; className?: string }) {
  const s = COVER_STYLES[Math.abs(hash(book.id)) % COVER_STYLES.length];
  const [failed, setFailed] = useState(false);
  return (
    <div className={cx("relative flex aspect-[2/3] items-end p-[10px]", className)}>
      <div className="rough-big absolute inset-0" style={{ background: s.bg, border: s.border ? `1.2px solid ${s.border}` : undefined }} />
      {book.cover_url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={book.cover_url} alt="" onError={() => setFailed(true)} className="absolute inset-[3px] h-[calc(100%-6px)] w-[calc(100%-6px)] object-cover" loading="lazy" />
      ) : (
        <span className="relative font-serif text-[15px] leading-[1.1] italic [hyphens:auto]" style={{ color: s.fg }}>
          {book.title}
        </span>
      )}
    </div>
  );
}

/** Object URL for a locally stored image; downloads it once if this device doesn't have it yet. */
export function useImageUrl(imageId: string | null | undefined) {
  const row = useLiveQuery(async () => (imageId ? ((await db.files.get(imageId)) ?? null) : undefined), [imageId]);
  const blob = row?.blob ?? null;
  useEffect(() => {
    if (imageId && (row === null || (row && !row.blob && !row.deleted))) void loadImage(imageId);
  }, [imageId, row]);
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  return url;
}

/** Photo "tipped in" to the page: white border, slight rotation, washi tape. */
export function TippedPhoto({ imageId, src, alt, rotate = -1.4, className, height }: { imageId?: string | null; src?: string; alt: string; rotate?: number; className?: string; height?: number }) {
  const local = useImageUrl(src ? null : imageId);
  const url = src ?? local;
  return (
    <figure className={cx("relative m-0", className)}>
      <div className="photo-in bg-white p-2 shadow-[0_1px_1px_rgba(27,29,34,.06),0_6px_14px_-6px_var(--shadow)]" style={{ transform: `rotate(${rotate}deg)`, ["--r" as string]: `${rotate}deg` }}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={alt} className="block w-full object-cover" style={{ height }} />
        ) : (
          <div className="flex items-center justify-center bg-[repeating-linear-gradient(135deg,#eeede9_0_6px,#f5f4f1_6px_12px)] font-mono text-[11px] text-[#5b606a]" style={{ height: height ?? 140 }} role="img" aria-label={alt}>
            {imageId ? "photo not on this device yet" : "no photo"}
          </div>
        )}
      </div>
      <div aria-hidden="true" className="rough-big absolute -top-[11px] left-1/2 h-6 w-[86px] -ml-[43px] rotate-3" style={{ background: "var(--tape)" }} />
    </figure>
  );
}

/** A printer's mark with its spoken name. */
export function MarkGlyph({ mark, className }: { mark: Mark | null | undefined; className?: string }) {
  const m = markOf(mark);
  if (!m) return null;
  return (
    <span className={cx("font-serif text-xl leading-none text-accent", className)} role="img" aria-label={m.spoken}>
      {m.glyph}
    </span>
  );
}

/** The reader's own margin note, in handwriting with a curling arrow. */
export function MarginNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-start gap-[6px]", className)}>
      <svg width="26" height="26" viewBox="0 0 26 26" className="rough flex-none" aria-hidden="true">
        <path d="M4 22 C 4 12, 10 6, 20 5 M15 1.5 L20.5 5 L16 9.5" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="mt-[6px] -rotate-[0.8deg] font-hand text-[17px] leading-[1.35] text-accent">
        <span className="sr-only">Margin note: </span>
        {children}
      </p>
    </div>
  );
}

/** Bottom sheet on phones, centred card on desktop. Native <dialog>: focus trap + Esc for free. */
export function Sheet({ open, onClose, title, children, className }: { open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={cx("sheet", className)}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="flex flex-col gap-6 px-6 pt-7 pb-[calc(env(safe-area-inset-bottom)+32px)] md:px-8 md:pb-8">{children}</div>
    </dialog>
  );
}

/** Small uppercase section label used across forms. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("text-xs font-medium uppercase tracking-[.06em] text-muted", className)}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="font-serif text-lg italic text-muted">{children}</p>;
}

/** Subtle "saved just now" autosave hint. */
export function SavedHint({ at }: { at: string | undefined }) {
  // Clock lives in state so render stays pure; ticks every 30s.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!at) return null;
  const s = (Math.max(clock, new Date(at).getTime()) - new Date(at).getTime()) / 1000;
  const text = s < 60 ? "saved just now" : s < 3600 ? `saved ${Math.floor(s / 60)} min ago` : "saved";
  return (
    <span className="text-[13px] text-muted" aria-live="polite">
      {text}
    </span>
  );
}

