import { beforeEach, expect, test } from "vitest";
import { db } from "./db";
import { addBook, addPassage, remove, saveReflection, setUserId, updatePassage } from "./repo";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  setUserId("u1");
});

test("new rows are owned, dirty and private by default", async () => {
  const id = await addBook({ title: "Émile, or On Education", author: "Rousseau" });
  const b = (await db.books.get(id))!;
  expect(b.user_id).toBe("u1");
  expect(b._dirty).toBe(1);
  expect(b.visibility).toBe("private");
  expect(Object.values(b.share).every((v) => v === false)).toBe(true);
  expect(b.slug).toBe("emile-or-on-education");
});

test("a g.-tagged passage creates exactly one glossary word (R-WRD-1)", async () => {
  const book = await addBook({ title: "T", author: "A" });
  const p = await addPassage({ book_id: book, mark: "glossary", text: "ardent", page: "9" });
  await updatePassage(p, { note: "again" });
  const words = await db.words.where("passage_id").equals(p).toArray();
  expect(words).toHaveLength(1);
  expect(words[0].word).toBe("ardent");
  expect(words[0].page).toBe("9");
});

test("tagging an inbox passage g. later creates the word once it has a book", async () => {
  const book = await addBook({ title: "T", author: "A" });
  const p = await addPassage({ text: "a long sentence that is not a single word" });
  expect(await db.words.count()).toBe(0);
  await updatePassage(p, { book_id: book, mark: "glossary" });
  const [w] = await db.words.toArray();
  expect(w.passage_id).toBe(p);
  expect(w.word).toBe(""); // too long to guess; user fills it in
});

test("remove is a tombstone so the delete can sync", async () => {
  const id = await addBook({ title: "T", author: "A" });
  await db.books.update(id, { _dirty: 0 });
  await remove("books", id);
  const b = (await db.books.get(id))!;
  expect(b.deleted_at).not.toBeNull();
  expect(b._dirty).toBe(1);
});

test("reflection is 1:1 with its book and upserts", async () => {
  const book = await addBook({ title: "T", author: "A" });
  await saveReflection(book, { takeaway: "one" });
  await saveReflection(book, { verdict: "loved" });
  const r = (await db.reflections.get(book))!;
  expect(r.takeaway).toBe("one");
  expect(r.verdict).toBe("loved");
  expect(await db.reflections.count()).toBe(1);
});

test("slugs stay unique within a library", async () => {
  const a = await addBook({ title: "Walden", author: "A" });
  const b = await addBook({ title: "Walden", author: "B" });
  expect((await db.books.get(a))!.slug).toBe("walden");
  expect((await db.books.get(b))!.slug).toBe("walden-2");
});

test("deleting a book tombstones everything that belongs to it and its photos", async () => {
  const { deleteBook, saveImage, addWord } = await import("./repo");
  const book = await addBook({ title: "T", author: "A" });
  const img = await saveImage(new Blob(["x"], { type: "image/jpeg" }));
  const p = await addPassage({ book_id: book, image_id: img, mark: "glossary", text: "word" });
  await addWord({ book_id: book, word: "other" });
  await saveReflection(book, { takeaway: "x" });
  await deleteBook(book);
  expect((await db.passages.get(p))!.deleted_at).not.toBeNull();
  expect((await db.words.toArray()).every((w) => w.deleted_at)).toBe(true);
  expect((await db.reflections.get(book))!.deleted_at).not.toBeNull();
  expect((await db.files.get(img))!.deleted).toBe(1);
});
