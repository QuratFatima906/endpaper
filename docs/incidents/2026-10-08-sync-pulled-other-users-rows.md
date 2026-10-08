# Incident: sync copied other readers' shared books onto every signed-in device

| | |
|---|---|
| **Date found** | 2026-10-08 |
| **Introduced** | `dd7b409` (2026-10-02), the first version of the sync engine |
| **Fixed in** | `fix/sync-pull-own-rows`, merged to `main` and deployed 2026-10-08 |
| **Severity** | High (privacy / data integrity). No private data leaked. |
| **Affected** | Every signed-in user, on every device, since launch |

## Summary

A signed-in reader saw a book they had never added, *In a Kingdom by the Sea* with its word list, in their own library. It belonged to another user (@ali), who had shared it publicly.

The sync engine's pull asked Supabase for "every row changed since my cursor" without saying "and owned by me". It relied on row-level security (RLS) to scope the result to the current user. But RLS also has `public_read` policies, so the database correctly returned every **shared** book, passage, word, reflection, page, essay and profile from **every** user. The sync engine then stored them in the local IndexedDB as if they were the reader's own.

## What the reader saw

1. They opened `https://endpaper-alpha.vercel.app/@ali/in-a-kingdom-by-the-sea`, another user's public book page.
2. They went back to their own library.
3. Ali's book was on their shelf, with all of Ali's words.

Opening the public page looked like the cause, but it wasn't. The public page is server-rendered and never touches IndexedDB. The book appeared because the next background sync, which runs on load, on focus and every 60 seconds, pulled it in. Any shared book from any user would have appeared the same way, whether or not anyone visited it.

## How we found the cause

1. **First theory: local storage is shared between accounts.** The data layer is local-first, so "another user's data in my local database" pointed at IndexedDB not being separated per user. We checked `signOut()` in `src/lib/session.tsx`: it calls `clearLocal()`, which wipes every table on sign-out. Switching accounts on one device was already safe, so this wasn't it.
2. **Can the public page write locally?** `src/components/public-book.tsx` and `src/app/u/*` render on the server from Supabase data and import nothing from `db.ts` or `repo.ts`. They can't write to IndexedDB, so it wasn't this either.
3. **What else writes to IndexedDB?** Only `repo.ts` (the reader's own edits, always stamped with their `user_id`) and the sync pull in `src/lib/sync.ts`. The pull was:
   ```ts
   supabase().from(t).select("*").gt("server_updated_at", cursor)
   ```
   It had no owner filter.
4. **Why did the database return other people's rows?** In `supabase/migrations/0001_init.sql`, each table has two `SELECT` policies:
   - `owner`: `user_id = auth.uid()`
   - `public_read`: the book is not private, the section is shared, and the row isn't hidden or deleted

   Postgres combines permissive policies with **OR**. A signed-in user's unfiltered `select *` therefore returns their own rows **plus** every publicly shared row in the system. This is correct RLS behaviour; the public pages depend on it. The bug was treating RLS as a query filter.
5. **Proof:** we added a test that puts another user's shared book on the fake server and runs a sync. On the old code the test fails (the book lands locally); with the fix it passes.

## Root cause

> **RLS decides what a user *may* read. It does not decide what a query *should* read.**

The pull needed "my rows" but asked for "rows I'm allowed to see". While only the `owner` policy existed, those were the same set. Adding `public_read` for shareable pages made them differ, and the pull silently widened with it.

## Impact

**Copied onto signed-in users' devices:** shared rows from other users in `books`, `passages`, `words`, `reflections`, `pages`, published `essays`, and non-hidden `profiles`. All of it is content its owners had chosen to make public.

**Not exposed:**
- Private books and unshared sections. `public_read` excludes them, and the database enforced that throughout.
- Check-in free text. `checkins` has no public policy.
- Passage photos. The storage bucket is private, with a folder per user.

**Could another user's data be changed?** No. Every table's write policy is `with check (user_id = auth.uid())`, so any push of a foreign row is rejected by the database. If a reader edited a foreign book on their device, that push would fail, and the sync would stop at that table on every run until the row is removed (see "Known edge" below).

**Side effects:** strangers' books showed in readers' libraries, counts and exports. Each device also downloaded every shared row in the system on its first sync, so sync traffic grew with the whole user base instead of with one user's data.

## The fix

`src/lib/sync.ts`, `pullTable`:

```ts
// Profiles are keyed by the user id itself; every other table carries user_id.
const ownerCol = (t: SyncTable) => (t === "profiles" ? "id" : "user_id");

async function pullTable(t: SyncTable) {
  const me = userId();
  const owner = ownerCol(t);
  // Clear out anything another user's rows left here (devices that synced before this filter).
  await db[t].filter((r) => r[owner] !== me && !r._dirty).delete();
  ...
  supabase().from(t).select("*").eq(owner, me).gt("server_updated_at", cursor)
```

1. **Filter the pull by owner.** `.eq("user_id", me)` (or `.eq("id", me)` for `profiles`) makes the query say what it means. RLS is still the security boundary; this only makes the query ask for the right rows. It also matches the existing `(user_id, server_updated_at)` index, so the pull is cheaper too.
2. **Clean up devices that already have foreign rows.** On every pull, rows owned by someone else are deleted from the local table. Readers who were affected recover automatically on their next sync, with no action and no migration.
3. **Never delete unsynced work.** Rows with `_dirty` set are skipped, so a local edit that hasn't been pushed is never thrown away.

The pull cursor needed no reset. It had already moved past the reader's own rows as well as the foreign ones, so the reader's data is unaffected.

### Known edge

A foreign row that the reader *edited* is dirty, so the cleanup keeps it. Its push is then rejected by RLS on every sync, which stops the rest of that sync run. This needs a reader to have edited a stranger's book in the few days the bug was live. If it shows up (sync status stuck on "error"), the fix is to drop foreign rows even when dirty, because they can never be pushed anyway.

## Verification

- New unit test, `src/lib/sync.test.ts`: "pull ignores other users' shared rows and clears ones already on the device". It **fails on the old code and passes on the fix**.
- Full unit suite (22 tests), typecheck and lint pass.
- In production: open the app while signed in. After the first sync, which runs on load, Ali's book is gone from the library.

## Follow-ups

| Priority | Item | Why |
|---|---|---|
| P1 | **Column-level exposure of shared rows.** `public_read` is row-level only, and no column grants are set, so anyone with the public anon key can `select *` a shared book over the Supabase REST API. That includes columns the public page never shows: `goodreads_review`, `goodreads_rating`, `isbn`, `share`, reflection `ratings`, profile `theme`/`text_size`. Fix with public views (or `security definer` functions) that return only visitor-safe columns, and drop `public_read` from the base tables. | This bug didn't create the exposure, but it is the same lesson: RLS filters rows, not columns, and not intent. |
| P2 | Any new client-side query against a table with a public policy must filter by owner explicitly. Add this to code review. | Prevents the next variant of this bug. |
| P3 | Drop dirty foreign rows too, if the "known edge" above is ever seen. | Unblocks a stuck sync. |

## Lessons

- **Permissive RLS policies add up.** Adding a `public_read` policy changes the result of every existing authenticated query on that table, not just the new public ones.
- **Don't use authorization as a filter.** "May read" and "wants to read" are different sets. Write the filter you mean, and let RLS be the safety net behind it.
- **Test with a second user in the fixture.** The sync tests only ever had one user, so a missing owner filter couldn't fail. The new test seeds a second user's shared row.
