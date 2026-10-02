# Decisions

Short log of choices the requirements didn't settle (spec §0.1). Newest last.

| Date | Decision | Reason | Alternatives considered |
|---|---|---|---|
| 2026-09-30 | **Offline-first: IndexedDB (Dexie) is the UI's source of truth.** Screens read with `useLiveQuery`, write through `src/lib/repo.ts`, and a background sync engine pushes/pulls Supabase. | R-PAS-8 needs capture offline; one data path is simpler than online+offline branches. | Server-first with an offline queue (two code paths); CRDT library such as Yjs/Automerge (heavy for single-owner data). |
| 2026-09-30 | **Sync = outbox of dirty rows + pull by server cursor; last-write-wins per row on client `updated_at`.** A server-stamped `server_updated_at` drives the pull cursor. | Single owner, few devices, so conflicts are rare. Server cursor makes clock skew harmless. | Field-level merge (add if the same passage gets edited on two devices often). |
| 2026-09-30 | **Deletes are tombstones (`deleted_at`).** | Deletes must reach other devices. Account deletion hard-deletes everything via cascade. | Hard delete with a separate deletions log. |
| 2026-09-30 | **Private routes are static paths with query params** (`/book?id=`) and client-rendered. Public pages (`/@user/...`) are server-rendered. | The service worker can precache every private shell for a cold offline start; public pages need SEO/Open Graph (R-PUB-12). | Dynamic segments with runtime caching (cold offline load of an unvisited book fails). |
| 2026-09-30 | **Hand-written `public/sw.js`** instead of Serwist. | About 100 lines; avoids build-plugin coupling with Next 16/Turbopack (§13.1 ⚠ Verify). | Serwist (Next docs list it; revisit if precaching needs grow). |
| 2026-09-30 | **No `@supabase/ssr`; session in localStorage.** | Editor is client-only and must open offline; public pages need no session. Server routes verify a bearer token. | Cookie sessions (needs network at the edge to render). |
| 2026-09-30 | **Supabase Storage instead of R2** for images (private bucket, one folder per user). | One vendor, RLS on objects, fewer secrets. | Cloudflare R2 (cheaper egress at scale; swap in `sync.ts` + delete route). |
| 2026-09-30 | **Device-only mode** when Supabase env vars are empty: one local account, no sync. | App runs before the owner provisions services; useful for development. | Refuse to start without config. |
| 2026-09-30 | **Plain autosizing textareas instead of TipTap** for reflection and essays. Paragraphs are blank-line separated. | "Less is more"; no formatting UI appears in the designs; avoids a large dependency. | TipTap (R-REF-3). Add it if formatting is wanted. |
| 2026-09-30 | **Verdict labels follow the design (Loved it / Liked it / Not for me)**, not spec §2.2 (Keep · Lend · Let go). Stored as keys; labels live in `src/lib/marks.ts`. | The newest design file shows these. **Owner to confirm.** | Keep · Lend · Let go. |
| 2026-09-30 | **Accent colour is ink blue (#2A4BB5)**, not oxblood (§0.2 default). | The final design file uses ink blue throughout. Swap with one token in `globals.css`. | Oxblood (earlier design file). |
| 2026-09-30 | **Charts: a hand-drawn SVG polyline** for the mood line, no Recharts. | It's one line drawn once (§2.4); a chart library would be dead weight. | Recharts. |
| 2026-09-30 | **PDF export uses the browser's print dialog** with a print stylesheet. | Native "Save as PDF" everywhere; no PDF library. | A client-side PDF library such as pdf-lib or react-pdf. |
| 2026-09-30 | **Public passages expose transcribed text only; photos are never served publicly.** | R-PUB-10 default until the legal position is verified. | Public photos per section. |
| 2026-09-30 | **Check-in free text is never public**: the mood line is served by `public_mood_line()` (date, mood, understanding only). | Row-level security can't hide individual columns. | Column-level grants on a view. |

## Proposed additions (not built)
- Admin dashboard + moderation queue UI (R-ADM-*): the design file's admin flow was truncated in the export; `reports` and `deletion_log` tables are ready.
- Cookieless analytics (R-ADM-1): needs a Umami/PostHog instance (owner action).
- Hardcover integration, reading-year page, digital highlighting (LATER).
