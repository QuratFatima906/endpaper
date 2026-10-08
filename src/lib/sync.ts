import { useSyncExternalStore } from "react";
import { db, getMeta, setMeta, SYNC_TABLES } from "./db";
import { onLocalWrite, userId } from "./repo";
import { cloudEnabled, IMAGE_BUCKET, supabase } from "./supabase";
import type { SyncTable } from "./types";

// Sync engine: push dirty rows (outbox), then pull rows changed on the server since
// the last cursor. Conflicts resolve last-write-wins on the client `updated_at`;
// the pull cursor uses the server-stamped `server_updated_at` so clock skew between
// devices can never make a change invisible.
// ponytail: row-level LWW, field-level merge if two devices edit the same passage often.

type State = { status: "idle" | "syncing" | "offline" | "error" | "local"; pending: number; lastSynced: string | null };
let state: State = { status: cloudEnabled ? "idle" : "local", pending: 0, lastSynced: null };
const listeners = new Set<() => void>();
const set = (s: Partial<State>) => {
  state = { ...state, ...s };
  listeners.forEach((l) => l());
};

export function useSyncState() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => void listeners.delete(l)),
    () => state,
    () => state,
  );
}

const strip = (row: Record<string, unknown>) => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (!k.startsWith("_") && k !== "server_updated_at") out[k] = v;
  return out;
};

async function countPending() {
  let n = await db.files.where("uploaded").equals(0).count();
  for (const t of SYNC_TABLES) n += await db[t].where("_dirty").equals(1).count();
  return n;
}

async function pushTable(t: SyncTable) {
  const table = db[t];
  const dirty = (await table.where("_dirty").equals(1).toArray()) as Record<string, unknown>[];
  for (let i = 0; i < dirty.length; i += 200) {
    const chunk = dirty.slice(i, i + 200);
    const { error } = await supabase().from(t).upsert(chunk.map(strip));
    if (error) throw error;
    // Only clear the flag if the row was not edited again while we were uploading.
    await db.transaction("rw", table, async () => {
      for (const row of chunk) {
        const cur = (await table.get(row.id as string)) as Record<string, unknown> | undefined;
        if (cur && cur.updated_at === row.updated_at) await table.update(row.id as string, { _dirty: 0 } as never);
      }
    });
  }
}

// Profiles are keyed by the user id itself; every other table carries user_id.
const ownerCol = (t: SyncTable) => (t === "profiles" ? "id" : "user_id");

async function pullTable(t: SyncTable) {
  // Public-read RLS lets any signed-in user see other people's shared books, so the pull
  // must ask for this user's rows explicitly or it copies strangers' shelves onto the device.
  const me = userId();
  const owner = ownerCol(t);
  // Clear out anything another user's rows left here (devices that synced before this filter).
  await db[t].filter((r) => (r as Record<string, unknown>)[owner] !== me && !r._dirty).delete();
  const key = `cursor:${t}`;
  let cursor = (await getMeta<string>(key)) ?? "1970-01-01T00:00:00Z";
  for (;;) {
    const { data, error } = await supabase()
      .from(t)
      .select("*")
      .eq(owner, me)
      .gt("server_updated_at", cursor)
      .order("server_updated_at", { ascending: true })
      .limit(500);
    if (error) throw error;
    if (!data?.length) break;
    const table = db[t];
    await db.transaction("rw", table, async () => {
      for (const remote of data) {
        const local = (await table.get(remote.id)) as Record<string, unknown> | undefined;
        if (local?._dirty && (local.updated_at as string) > remote.updated_at) continue; // local edit is newer
        await table.put({ ...remote, _dirty: 0 } as never);
      }
    });
    cursor = data[data.length - 1].server_updated_at;
    await setMeta(key, cursor);
    if (data.length < 500) break;
  }
}

async function pushFiles() {
  const store = supabase().storage.from(IMAGE_BUCKET);
  for (const f of await db.files.where("uploaded").equals(0).toArray()) {
    if (f.deleted || !f.blob) continue;
    const { error } = await store.upload(`${f.user_id}/${f.id}`, f.blob, { contentType: f.mime, upsert: true });
    if (error) throw error;
    await db.files.update(f.id, { uploaded: 1 });
  }
  const gone = await db.files.where("deleted").equals(1).toArray();
  if (gone.length) {
    const { error } = await store.remove(gone.map((f) => `${f.user_id}/${f.id}`));
    if (error) throw error;
    await db.files.bulkDelete(gone.map((f) => f.id));
  }
}

// `onLine` is undefined outside browsers; only an explicit false means offline.
const isOffline = () => globalThis.navigator?.onLine === false;

let running: Promise<void> | null = null;
let again = false;

export function syncNow(): Promise<void> {
  if (!cloudEnabled || userId() === "local") return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    if (isOffline()) {
      set({ status: "offline", pending: await countPending() });
      return;
    }
    set({ status: "syncing" });
    try {
      await pushFiles();
      for (const t of SYNC_TABLES) await pushTable(t);
      for (const t of SYNC_TABLES) await pullTable(t);
      set({ status: "idle", lastSynced: new Date().toISOString(), pending: await countPending() });
    } catch (e) {
      console.warn("[sync]", e);
      set({ status: isOffline() ? "offline" : "error", pending: await countPending() });
    }
  })().finally(() => {
    running = null;
    if (again) {
      again = false;
      void syncNow();
    }
  });
  return running;
}

let timer: ReturnType<typeof setTimeout> | undefined;
let started = false;

/** Start background sync. Safe to call more than once. */
export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  onLocalWrite(() => {
    clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), 1200);
    void countPending().then((pending) => set({ pending }));
  });
  window.addEventListener("online", () => void syncNow());
  window.addEventListener("offline", () => set({ status: "offline" }));
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void syncNow());
  setInterval(() => document.visibilityState === "visible" && void syncNow(), 60_000);
  void syncNow();
}

/** Local blob if we have it; otherwise fetch from storage once and keep it for offline. */
export async function loadImage(id: string): Promise<Blob | null> {
  const f = await db.files.get(id);
  if (f?.blob) return f.blob;
  if (!cloudEnabled || !navigator.onLine) return null;
  const { data } = await supabase().storage.from(IMAGE_BUCKET).download(`${userId()}/${id}`);
  if (!data) return null;
  await db.files.put({ id, user_id: userId(), blob: data, mime: data.type, uploaded: 1, deleted: 0 });
  return data;
}
