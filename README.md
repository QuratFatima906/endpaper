# Endpaper

A memory lane for the books that stayed with you. It's an installable PWA that works fully offline.

```bash
pnpm install
pnpm dev          # http://localhost:3000. With no .env.local it runs device-only.
pnpm test         # unit tests (vitest)
pnpm e2e          # end-to-end: builds, then runs phone + desktop (Playwright)
```

First-time setup (Supabase, sign-in, Google, deploy) is in [docs/SETUP.md](docs/SETUP.md).

## How it fits together

```
 Browser (phone / desktop)                          Supabase
 ┌───────────────────────────────────────┐          ┌──────────────────────────┐
 │ Screens (React, client)               │          │ Postgres + RLS           │
 │   │ useLiveQuery    │ repo.ts writes  │  push    │  profiles, books,        │
 │   ▼                 ▼                 │ ───────► │  passages, words, …      │
 │ IndexedDB (Dexie) ◄── source of truth │ ◄─────── │ Storage: private images  │
 │   ▲  sync.ts: outbox + pull cursor    │  pull    │ Auth: magic link, Google │
 │ Service worker: app shell, fonts, OCR │          └──────────────────────────┘
 └───────────────────────────────────────┘                 ▲ anon, RLS-filtered
   /@username/...  ◄── server-rendered public pages ───────┘
```

- **Private app** (`src/app/(app)/*`): static client routes with query params (`/book?id=`). The service worker precaches every shell, so a cold start works with no network.
- **Data**: every write lands in IndexedDB first. `src/lib/sync.ts` pushes dirty rows and pulls changes by a server-stamped cursor. Conflicts resolve last-write-wins per row.
- **Public side** (`src/app/u/*`, served at `/@username`): server-rendered from Supabase with the anon key. Row-level security decides what is visible. Photos are never public.
- Full system design (diagrams, trade-offs, security, scaling): [ARCHITECTURE.md](ARCHITECTURE.md). Smaller decisions: [DECISIONS.md](DECISIONS.md).

## Scaling notes
- Reads never hit the server, so load scales with writes, which are tiny rows.
- Pulls are incremental per table through the `(user_id, server_updated_at)` index.
- Public pages are the only server-rendered traffic. Put a CDN cache in front of them if they get popular (unpublishing is still immediate if you purge on publish changes).
- The known ceilings are marked in the code with `ponytail:` comments: in-memory search, row-level last-write-wins, and no rate limit on reports.
