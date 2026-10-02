"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useId, useRef, useState, useSyncExternalStore, type ComponentProps, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { IScannerControls } from "@zxing/browser";
import { findDuplicate } from "@/components/library-text";
import { AppHeader, BottomAction, Button, ButtonLink, Chip, Cover, Label, Page, Rule, Sheet, Tabs, TextField } from "@/components/ui";
import { lookupIsbn, searchBooks, type BookHit } from "@/lib/books-api";
import { db } from "@/lib/db";
import { STATUSES, statusLabel } from "@/lib/marks";
import { addBook } from "@/lib/repo";
import type { Book, Status } from "@/lib/types";

type Draft = Pick<Book, "title" | "author"> & Partial<Book>;
type Mode = "search" | "scan" | "type";

const onOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => (window.removeEventListener("online", cb), window.removeEventListener("offline", cb));
};
const WIDE = "(min-width: 768px)";
const onWide = (cb: () => void) => {
  const m = matchMedia(WIDE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const useOnline = () => useSyncExternalStore(onOnline, () => navigator.onLine, () => true);
const useWide = () => useSyncExternalStore(onWide, () => matchMedia(WIDE).matches, () => false);

const fromHit = (h: BookHit, status: Status): Draft => ({ title: h.title, author: h.author, isbn: h.isbn, cover_url: h.cover_url, description: h.description, source: h.source, status });

export default function AddPage() {
  return (
    <Suspense>
      <Add />
    </Suspense>
  );
}

function Add() {
  const router = useRouter();
  const params = useSearchParams();
  const mode: Mode = (["scan", "type"] as const).find((m) => m === params.get("mode")) ?? "search";
  const wide = useWide();
  const books = useLiveQuery(() => db.books.filter((b) => !b.deleted_at).toArray(), []);
  const [dup, setDup] = useState<{ draft: Draft; book: Book } | null>(null);
  const busy = useRef(false);

  async function add(draft: Draft, force = false) {
    if (busy.current) return;
    const existing = force ? undefined : findDuplicate(books ?? [], draft);
    if (existing) return setDup({ draft, book: existing });
    busy.current = true;
    const id = await addBook(draft);
    router.replace(`/book?id=${id}`);
  }

  const go = (m: Mode) => router.replace(m === "search" ? "/add" : `/add?mode=${m}`, { scroll: false });

  return (
    <Page>
      <div className="hidden md:block">
        <AppHeader active="library" />
      </div>
      <div className="mx-auto max-w-[560px] md:pt-10">
        <div className="grid grid-cols-[44px_1fr_44px] items-center pt-[calc(env(safe-area-inset-top)+18px)] md:flex md:justify-between md:pt-0">
          <Link href="/library" className="min-h-11 content-center text-sm md:order-2">
            <span className="md:hidden">Cancel</span>
            <span className="hidden md:inline">Close</span>
          </Link>
          <h1 className="text-center font-serif text-[17px] md:text-[26px]">Add a book</h1>
        </div>
        <Tabs
          label="Ways to add a book"
          className="mt-7 md:mt-4"
          tabs={[
            { label: "Search", active: mode === "search", onClick: () => go("search") },
            { label: wide ? "ISBN" : "Scan barcode", active: mode === "scan", onClick: () => go("scan") },
            { label: "Type it in", active: mode === "type", onClick: () => go("type") },
          ]}
        />
        <div key={mode} className="page-in">
          {mode === "search" && <SearchBooks onAdd={(h) => add(fromHit(h, "reading"))} />}
          {mode === "scan" && (wide ? <IsbnLookup onAdd={add} /> : <Scanner onAdd={add} onCancel={() => go("search")} />)}
          {mode === "type" && <TypeItIn onAdd={add} isbn={params.get("isbn") ?? ""} title={params.get("title") ?? ""} />}
        </div>
      </div>

      <Sheet open={!!dup} onClose={() => setDup(null)} title="Already on your shelf">
        <h2 className="font-serif text-2xl">Already on your shelf</h2>
        <p className="text-[15px] leading-[1.5] text-muted">
          <span className="font-serif italic text-ink">{dup?.book.title}</span> is already in your library.
        </p>
        <div className="flex flex-col gap-3">
          {dup && <ButtonLink href={`/book?id=${dup.book.id}`}>Open it</ButtonLink>}
          <Button variant="quiet" onClick={() => dup && (setDup(null), add(dup.draft, true))}>
            Add it again
          </Button>
        </div>
      </Sheet>
    </Page>
  );
}

// ---- Search ------------------------------------------------------------------

function SearchBooks({ onAdd }: { onAdd: (h: BookHit) => void }) {
  const online = useOnline();
  const [q, setQ] = useState("");
  const [state, setState] = useState<{ q: string; hits: BookHit[] | null; error?: boolean }>({ q: "", hits: null });
  const latest = useRef("");

  useEffect(() => {
    const query = q.trim();
    latest.current = query;
    if (query.length < 2 || !online) return;
    const t = setTimeout(() => {
      searchBooks(query).then(
        (hits) => latest.current === query && setState({ q: query, hits }),
        () => latest.current === query && setState({ q: query, hits: [], error: true }),
      );
    }, 400);
    return () => clearTimeout(t);
  }, [q, online]);

  const query = q.trim();
  const current = state.q === query ? state : null;

  return (
    <div className="flex flex-col pb-10">
      <TextField className="mt-[22px]" type="search" aria-label="Title or author" placeholder="Title or author" autoFocus value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" />
      <div aria-live="polite" className="mt-[22px]">
        {!online ? (
          <p className="text-sm leading-[1.5] text-muted">Searching needs a connection. You can type the book in yourself and it will sync later.</p>
        ) : query.length >= 2 && !current ? (
          <p className="text-sm text-muted">Looking…</p>
        ) : current?.error ? (
          <p className="text-sm text-muted">Couldn&apos;t reach the book catalogues. Try again, or type it in.</p>
        ) : current?.hits?.length === 0 ? (
          <p className="text-sm text-muted">No matches.</p>
        ) : null}
        {current?.hits && current.hits.length > 0 && query.length >= 2 && (
          <ul className="flex flex-col">
            {current.hits.map((h, i) => (
              <li key={`${h.isbn}-${i}`}>
                {i > 0 && <Rule soft />}
                <div className="flex items-center gap-[14px] py-3">
                  <Thumb url={h.cover_url} />
                  <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <span className="font-serif text-lg leading-tight">{h.title}</span>
                    <span className="text-[13px] text-muted">{[h.author, h.year].filter(Boolean).join(" · ")}</span>
                  </div>
                  <Button variant="outline" size="md" className="!h-11 !px-4 text-[13px]" onClick={() => onAdd(h)} aria-label={`Add ${h.title}`}>
                    Add
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-8 text-center text-[13px] leading-[1.5] text-muted">
        Can&apos;t find it?{" "}
        <Link href={`/add?mode=type${query ? `&title=${encodeURIComponent(query)}` : ""}`} className="text-ink underline underline-offset-[3px]">
          Type it in yourself
        </Link>
      </p>
    </div>
  );
}

function Thumb({ url }: { url: string | null }) {
  return (
    <div className="relative h-[66px] w-11 flex-none border border-rule-soft bg-surface">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
      )}
    </div>
  );
}

// ---- ISBN: camera on phones, typed on laptops -------------------------------

type Lookup = { state: "idle" | "looking" | "none" | "error" } | { state: "found"; hit: BookHit };

function useLookup() {
  const [r, setR] = useState<Lookup>({ state: "idle" });
  const run = (isbn: string) => {
    setR({ state: "looking" });
    lookupIsbn(isbn).then(
      (hit) => setR(hit ? { state: "found", hit } : { state: "none" }),
      () => setR({ state: "error" }),
    );
  };
  return [r, run, () => setR({ state: "idle" })] as const;
}

function Found({ r, isbn, onAdd, onRetry }: { r: Lookup; isbn: string; onAdd: (d: Draft) => void; onRetry: () => void }) {
  const [status, setStatus] = useState<Status>("reading");
  if (r.state === "idle") return null;
  if (r.state === "looking") return <p className="text-sm text-muted" aria-live="polite">Looking up {isbn}…</p>;
  if (r.state !== "found")
    return (
      <div className="flex flex-col gap-3" aria-live="polite">
        <p className="text-[15px] leading-[1.5]">{r.state === "none" ? `No book found for ${isbn}.` : "Couldn't reach the book catalogues."}</p>
        <div className="flex gap-5 text-sm">
          <Link href={`/add?mode=type&isbn=${isbn}`} className="min-h-11 content-center text-accent">
            Type it in
          </Link>
          <button type="button" onClick={onRetry} className="min-h-11 text-muted">
            Try another
          </button>
        </div>
      </div>
    );
  const { hit } = r;
  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <div className="flex items-center gap-[14px]">
        <Cover book={{ id: hit.isbn ?? hit.title, title: hit.title, cover_url: hit.cover_url }} className="w-10 flex-none !p-0 [&>span]:hidden" />
        <div className="flex flex-col gap-[3px]">
          <span className="text-xs text-accent">Found</span>
          <span className="font-serif text-[19px] leading-tight">{hit.title}</span>
          <span className="text-[13px] text-muted">{hit.author}</span>
        </div>
      </div>
      <div role="group" aria-label="Status" className="flex gap-2">
        {STATUSES.map((s) => (
          <Chip key={s.id} selected={status === s.id} onClick={() => setStatus(s.id)}>
            {s.label}
          </Chip>
        ))}
      </div>
      <Button size="md" onClick={() => onAdd(fromHit(hit, status))}>
        Add to {statusLabel(status)}
      </Button>
    </div>
  );
}

function IsbnLookup({ onAdd }: { onAdd: (d: Draft) => void }) {
  const [isbn, setIsbn] = useState("");
  const [r, run, reset] = useLookup();
  const online = useOnline();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (isbn.replace(/[^0-9Xx]/g, "").length >= 10) run(isbn);
  };
  return (
    <div className="flex flex-col gap-6 pt-[22px] pb-10">
      <form onSubmit={submit} className="flex items-end gap-3">
        <TextField className="flex-1" label="ISBN" inputMode="numeric" autoComplete="off" value={isbn} onChange={(e) => (setIsbn(e.target.value), reset())} hint="On a laptop, type the ISBN from the back cover instead of scanning." />
        <Button type="submit" variant="outline" size="md" className="mb-[30px]" disabled={!online}>
          Look up
        </Button>
      </form>
      {!online && <p className="text-sm text-muted">Looking up a book needs a connection. You can type it in yourself.</p>}
      <Found r={r} isbn={isbn} onAdd={onAdd} onRetry={() => (setIsbn(""), reset())} />
    </div>
  );
}

function Scanner({ onAdd, onCancel }: { onAdd: (d: Draft) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const online = useOnline();
  const [problem, setProblem] = useState<"denied" | "nocam" | null>(null);
  const [isbn, setIsbn] = useState("");
  const [r, run, reset] = useLookup();
  const runRef = useRef(run);
  useEffect(() => void (runRef.current = run));

  // (Re)start the camera whenever we're waiting for a barcode.
  const scanning = online && !isbn && !problem;
  useEffect(() => {
    if (!scanning) return;
    let controls: IScannerControls | undefined;
    let gone = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setProblem("nocam");
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      try {
        const c = await new BrowserMultiFormatReader().decodeFromConstraints({ video: { facingMode: "environment" } }, video.current!, (res, _err, ctl) => {
          const text = res?.getText();
          if (!text || !/^97[89]\d{10}$/.test(text)) return;
          ctl.stop();
          setIsbn(text);
          runRef.current(text);
        });
        if (gone) c.stop();
        else controls = c;
      } catch (e) {
        if (!gone) setProblem((e as Error).name === "NotAllowedError" ? "denied" : "nocam");
      }
    })();
    return () => {
      gone = true;
      controls?.stop();
    };
  }, [scanning]);

  const message = !online
    ? "You're offline, so the book can't be looked up right now."
    : problem === "denied"
      ? "Endpaper doesn't have permission to use the camera. You can allow it in your browser settings."
      : problem === "nocam"
        ? "No camera is available on this device."
        : null;

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-black text-white">
      <div className="grid grid-cols-[64px_1fr_64px] items-center px-6 pt-[calc(env(safe-area-inset-top)+18px)]">
        <button type="button" onClick={onCancel} className="min-h-11 text-left text-sm">
          Cancel
        </button>
        <h2 className="text-center font-serif text-[17px]">Scan the barcode</h2>
      </div>
      <div className="relative mx-9 mt-16 h-80 overflow-hidden bg-white/10">
        <video ref={video} muted playsInline className="h-full w-full object-cover" aria-label="Camera view" />
        <svg viewBox="0 0 270 130" className="rough absolute inset-x-6 top-1/2 -translate-y-1/2" aria-hidden="true">
          <path d="M2 30 V2 H30 M240 2 H268 V30 M268 100 V128 H240 M30 128 H2 V100" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
      <p className="mx-6 mt-7 text-center text-[15px] leading-[1.5]" role="status">
        {message ?? "Line up the barcode on the back cover"}
      </p>
      {message && (
        <Link href="/add?mode=type" className="mx-auto mt-2 min-h-11 content-center text-sm underline underline-offset-[3px]">
          Type it in instead
        </Link>
      )}
      {isbn && (
        <div className="absolute inset-x-0 bottom-0 rounded-t-[20px] bg-paper px-6 pt-[22px] pb-[calc(env(safe-area-inset-bottom)+24px)] text-ink">
          <Found r={r} isbn={isbn} onAdd={onAdd} onRetry={() => (setIsbn(""), reset())} />
        </div>
      )}
    </div>
  );
}

// ---- Type it in --------------------------------------------------------------

function Line({ label, ...rest }: { label: string } & ComponentProps<"input">) {
  const id = useId();
  return (
    <div className="flex flex-col gap-[6px]">
      <Label htmlFor={id}>{label}</Label>
      <input id={id} className="bg-transparent font-serif text-xl outline-none placeholder:text-faint" {...rest} />
      <Rule />
    </div>
  );
}

function TypeItIn({ onAdd, isbn: isbn0, title: title0 }: { onAdd: (d: Draft) => void; isbn: string; title: string }) {
  const [title, setTitle] = useState(title0);
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState(isbn0);
  const [status, setStatus] = useState<Status>("reading");
  const [error, setError] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError(true);
    onAdd({ title: title.trim(), author: author.trim(), isbn: isbn.replace(/[^0-9Xx]/g, "") || null, status, source: "manual" });
  };

  return (
    <form id="type-it-in" onSubmit={submit} className="mt-[34px] flex flex-col gap-6 pb-10" noValidate>
      <div>
        <Line label="Title" required aria-invalid={error} aria-describedby={error ? "title-err" : undefined} placeholder="The book's title" value={title} onChange={(e) => (setTitle(e.target.value), setError(false))} autoFocus={!title0} />
        {error && (
          <p id="title-err" role="alert" className="mt-2 text-[13px] text-accent">
            A title is all we need.
          </p>
        )}
      </div>
      <Line label="Author" placeholder="Who wrote it" value={author} onChange={(e) => setAuthor(e.target.value)} />
      <Line label="ISBN (optional)" inputMode="numeric" placeholder="From the back cover" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
      <div className="flex flex-col gap-[10px]">
        <Label>Status</Label>
        <div role="group" aria-label="Status" className="flex gap-2">
          {STATUSES.map((s) => (
            <Chip key={s.id} selected={status === s.id} onClick={() => setStatus(s.id)}>
              {s.label}
            </Chip>
          ))}
        </div>
      </div>
      <Button type="submit" size="md" className="mt-4 hidden self-start md:inline-flex">
        Add book
      </Button>
      <BottomAction>
        <Button type="submit" form="type-it-in">
          Add book
        </Button>
      </BottomAction>
    </form>
  );
}
