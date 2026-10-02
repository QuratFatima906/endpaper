import { describe, expect, it } from "vitest";
import { checkedByDefault, cleanIsbn, isDuplicate, parseCsv, parseGoodreads, statusFor } from "./goodreads";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas and newlines in fields, CRLF and BOM", () => {
    const csv = '﻿a,b,c\r\n"x, y","say ""hi""","line1\nline2"\r\n1,,3\n';
    expect(parseCsv(csv)).toEqual([
      ["a", "b", "c"],
      ["x, y", 'say "hi"', "line1\nline2"],
      ["1", "", "3"],
    ]);
  });
  it("keeps a last row without a trailing newline and skips blank lines", () => {
    expect(parseCsv("a,b\n\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
  it("keeps a trailing empty field", () => {
    expect(parseCsv("a,\n")).toEqual([["a", ""]]);
  });
});

describe("cleanIsbn", () => {
  it("strips the Goodreads =\"…\" wrapper", () => {
    expect(cleanIsbn('="0141439513"')).toBe("0141439513");
    expect(cleanIsbn('="9780141439518"')).toBe("9780141439518");
    expect(cleanIsbn('="080442957x"')).toBe("080442957X");
    expect(cleanIsbn('=""')).toBeNull();
  });
});

describe("parseGoodreads", () => {
  const csv = [
    // Columns deliberately out of the usual order: lookup is by header name.
    "Book Id,Author,Title,ISBN,ISBN13,My Rating,Date Read,Exclusive Shelf,My Review",
    '1,George Eliot,Middlemarch,"=""0141439548""","=""9780141439549""",5,2024/03/15,read,"Loved it.<br/>Again."',
    '2,Charles Dickens,"Bleak House",="",="",0,,to-read,',
    '3,"Gaskell, Elizabeth",North and South,,,3,,currently-reading,',
  ].join("\r\n");
  const books = parseGoodreads(csv);

  it("maps fields by header", () => {
    expect(books).toHaveLength(3);
    expect(books[0]).toMatchObject({
      title: "Middlemarch",
      author: "George Eliot",
      isbn: "9780141439549",
      isbn10: "0141439548",
      rating: 5,
      review: "Loved it.\nAgain.",
      dateRead: "2024-03-15T12:00:00.000Z",
      year: "2024",
    });
    expect(books[1]).toMatchObject({ isbn: null, rating: null, review: null, dateRead: null });
    expect(books[2].author).toBe("Gaskell, Elizabeth");
  });

  it("maps shelves", () => {
    expect(books.map((b) => statusFor(b.shelf))).toEqual(["finished", "reading", "reading"]);
    expect(books.map(checkedByDefault)).toEqual([true, false, true]);
  });

  it("detects duplicates by ISBN or normalised title + author", () => {
    expect(isDuplicate(books[0], [{ title: "x", author: "y", isbn: "9780141439549" }])).toBe(true);
    expect(isDuplicate(books[0], [{ title: "MIDDLEMARCH!", author: "george eliot", isbn: null }])).toBe(true);
    expect(isDuplicate(books[1], [{ title: "Middlemarch", author: "George Eliot", isbn: null }])).toBe(false);
  });

  it("rejects files without a Title column", () => {
    expect(() => parseGoodreads("foo,bar\n1,2")).toThrow();
  });
});
