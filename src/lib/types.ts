// Records mirror the Postgres rows 1:1 (snake_case) so sync needs no mapping layer.

export type Status = "reading" | "finished" | "set_aside";
export type Visibility = "private" | "unlisted" | "public";
export type Mark = "key" | "loved" | "confusing" | "disagree" | "glossary";
export type Verdict = "loved" | "liked" | "not_for_me";

type Base = {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Profile = Omit<Base, "user_id"> & {
  username: string;
  display_name: string;
  bio: string;
  profile_hidden: boolean;
  theme: "system" | "light" | "dark";
  text_size: "s" | "m" | "l";
};

export type ShareSections = {
  reflection: boolean;
  passages: boolean;
  words: boolean;
  pages: boolean;
  mood: boolean;
};

export type Book = Base & {
  title: string;
  author: string;
  isbn: string | null;
  cover_url: string | null;
  description: string | null;
  status: Status;
  visibility: Visibility;
  slug: string;
  share: ShareSections;
  started_at: string | null;
  finished_at: string | null;
  source: "manual" | "openlibrary" | "googlebooks" | "goodreads";
  goodreads_rating: number | null;
  goodreads_review: string | null;
};

export type Passage = Base & {
  book_id: string | null; // null = inbox
  image_id: string | null;
  text: string; // OCR or typed; editable
  alt: string; // defaults to text (R-A11Y-4)
  page: string;
  mark: Mark | null; // null = untagged → inbox
  note: string; // margin note, shown in handwriting
  hidden: boolean; // hide from a shared book (R-PUB-4)
};

export type Word = Base & {
  book_id: string;
  passage_id: string | null;
  word: string;
  definition: string;
  page: string;
};

export type Checkin = Base & {
  book_id: string;
  mood: string;
  understanding: number; // 1–5
  minutes: number | null;
  pages: string;
  text: string;
};

export type Reflection = Base & {
  book_id: string; // one per book; id === book_id
  takeaway: string;
  understood: string;
  unsure: string;
  recommend: string;
  verdict: Verdict | null;
  ratings: { ideas?: number; writing?: number; reread?: number };
};

export type Essay = Base & {
  book_id: string; // one per book; id === book_id
  title: string;
  body: string;
  slug: string;
  published_at: string | null;
};

export type PageItem = {
  id: string;
  kind: "passage" | "text" | "tape" | "corners";
  passage_id?: string;
  text?: string;
  x: number; // 0–1 of canvas width
  y: number; // 0–1 of canvas height
  w: number;
  r: number; // rotation, degrees
};

export type ScrapPage = Base & {
  book_id: string;
  position: number;
  items: PageItem[]; // array order = accessible reading order (R-PGS-3)
};

// Image blobs live locally; `uploaded` flips once they are in storage.
export type FileRow = {
  id: string;
  user_id: string;
  blob: Blob | null; // null until downloaded on another device
  mime: string;
  uploaded: 0 | 1;
  deleted: 0 | 1;
};

export type SyncTable = "profiles" | "books" | "passages" | "words" | "checkins" | "reflections" | "essays" | "pages";
