import { beforeEach, expect, test, vi } from "vitest";

// Fake Supabase: an in-memory "server" table with a server-stamped cursor column.
const server: Record<string, Record<string, unknown>[]> = { books: [] };
let clock = 0;
const stamp = () => new Date(Date.UTC(2026, 0, 1, 0, 0, clock++)).toISOString();

vi.mock("./supabase", () => ({
  cloudEnabled: true,
  IMAGE_BUCKET: "passages",
  supabase: () => ({
    from: (t: string) => {
      const rows = (server[t] ??= []);
      return {
        upsert: async (input: Record<string, unknown>[]) => {
          for (const r of input) {
            const i = rows.findIndex((x) => x.id === r.id);
            const row = { ...r, server_updated_at: stamp() };
            if (i >= 0) rows[i] = row;
            else rows.push(row);
          }
          return { error: null };
        },
        select: () => {
          let after = "";
          const eq: [string, unknown][] = [];
          const q = {
            eq: (c: string, v: unknown) => (eq.push([c, v]), q),
            gt: (_c: string, v: string) => ((after = v), q),
            order: () => q,
            limit: async () => ({ data: rows.filter((r) => (r.server_updated_at as string) > after && eq.every(([c, v]) => r[c] === v)), error: null }),
          };
          return q;
        },
      };
    },
    storage: { from: () => ({ upload: async () => ({ error: null }), remove: async () => ({ error: null }) }) },
  }),
}));

const { db } = await import("./db");
const { addBook, patch, setUserId } = await import("./repo");
const { syncNow } = await import("./sync");

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  server.books = [];
  setUserId("u1");
});

test("push clears the dirty flag and strips local-only fields", async () => {
  const id = await addBook({ title: "T", author: "A" });
  await syncNow();
  expect((await db.books.get(id))!._dirty).toBe(0);
  expect(server.books[0]).not.toHaveProperty("_dirty");
});

test("pull brings in rows edited on another device", async () => {
  server.books.push({ id: "b2", user_id: "u1", title: "From phone", updated_at: "2026-01-02T00:00:00Z", deleted_at: null, server_updated_at: stamp() });
  await syncNow();
  expect((await db.books.get("b2"))!.title).toBe("From phone");
});

test("a newer unsynced local edit is not overwritten by an older remote row", async () => {
  const id = await addBook({ title: "Old", author: "A" });
  await syncNow();
  await patch("books", id, { title: "Mine, newer" });
  // Another device wrote earlier (older updated_at) but reached the server later.
  const row = server.books.find((r) => r.id === id)!;
  Object.assign(row, { title: "Theirs, older", updated_at: "2000-01-01T00:00:00Z", server_updated_at: stamp() });
  // Pull only (simulate push failing): mark offline-safe by calling the pull path via syncNow after re-dirtying.
  await syncNow();
  expect((await db.books.get(id))!.title).toBe("Mine, newer");
  expect(server.books.find((r) => r.id === id)!.title).toBe("Mine, newer");
});

test("pull ignores other users' shared rows and clears ones already on the device", async () => {
  // Public-read RLS returns another reader's shared book; it must not land on this device.
  server.books.push({ id: "ali", user_id: "u2", title: "Someone else's", updated_at: "2026-01-02T00:00:00Z", deleted_at: null, server_updated_at: stamp() });
  await db.books.put({ id: "old", user_id: "u2", title: "Pulled before the fix", _dirty: 0 } as never);
  await syncNow();
  expect(await db.books.get("ali")).toBeUndefined();
  expect(await db.books.get("old")).toBeUndefined();
});
