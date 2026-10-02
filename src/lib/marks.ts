import type { Mark, Status, Verdict, Visibility } from "./types";

// Printer's marks as tags (spec §2.2). `spoken` is what screen readers announce.
export const MARKS: { id: Mark; glyph: string; name: string; spoken: string; hint: string }[] = [
  { id: "key", glyph: "✱", name: "Key point", spoken: "✱, key point", hint: "Key point: an insight or key idea. These are gathered into the book's Key points list." },
  { id: "loved", glyph: "¶", name: "Loved", spoken: "¶, loved passage", hint: "Loved: a passage you loved. ¶ is the pilcrow, the old sign for a new paragraph." },
  { id: "confusing", glyph: "?", name: "Confusing", spoken: "?, confusing", hint: "Confusing: something you didn't understand and want to come back to." },
  { id: "disagree", glyph: "†", name: "Disagree", spoken: "†, disagree", hint: "Disagree: a point you disagree with. † is the dagger, which printers use for footnotes and caveats." },
  { id: "glossary", glyph: "g.", name: "Glossary word", spoken: "g., glossary word", hint: "Glossary: a word to look up. These go into the Words tab." },
];
export const ALL_HINT = "All: every passage in the book.";
export const markOf = (m: Mark | null | undefined) => MARKS.find((x) => x.id === m);

export const STATUSES: { id: Status; label: string }[] = [
  { id: "reading", label: "Reading" },
  { id: "finished", label: "Finished" },
  { id: "set_aside", label: "Set aside" },
];
export const statusLabel = (s: Status) => STATUSES.find((x) => x.id === s)!.label;

export const VISIBILITY: { id: Visibility; label: string; hint: string }[] = [
  { id: "private", label: "Private", hint: "Only you" },
  { id: "unlisted", label: "Unlisted", hint: "Anyone with the link" },
  { id: "public", label: "Public", hint: "On your profile, findable by anyone" },
];
export const visibilityLabel = (v: Visibility) => VISIBILITY.find((x) => x.id === v)!.label;

// ponytail: the spec says Keep · Lend · Let go; the latest design says these. Swap labels here.
export const VERDICTS: { id: Verdict; label: string }[] = [
  { id: "loved", label: "Loved it" },
  { id: "liked", label: "Liked it" },
  { id: "not_for_me", label: "Not for me" },
];

export const MOODS = ["Restless", "Tired", "Absorbed", "Moved", "Calm"] as const;
