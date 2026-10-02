import { expect, test } from "vitest";
import { findDuplicate, findMatch, fold } from "./library-text";

test("fold ignores case and accents", () => {
  expect(fold("Émile BRONTË")).toBe("emile bronte");
});

test("findMatch maps folded matches back to original indices", () => {
  const s = "Charlotte Brontë wrote";
  const [a, b] = findMatch(s, "bronte")!;
  expect(s.slice(a, b)).toBe("Brontë");
  expect(findMatch("Straße", "sse")).toBeNull();
  expect(findMatch("anything", "  ")).toBeNull();
});

test("findDuplicate matches isbn or normalized title+author, skipping tombstones", () => {
  const books = [
    { title: "Jane Eyre", author: "Charlotte Brontë", isbn: "978-0-14-144114-6", deleted_at: null },
    { title: "Walden", author: "Thoreau", isbn: null, deleted_at: "2026-01-01" },
  ];
  expect(findDuplicate(books, { title: "x", author: "y", isbn: "9780141441146" })).toBe(books[0]);
  expect(findDuplicate(books, { title: "jane eyre.", author: "Charlotte Bronte" })).toBe(books[0]);
  expect(findDuplicate(books, { title: "Walden", author: "Thoreau" })).toBeUndefined();
});
