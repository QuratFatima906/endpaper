import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** False until the owner fills in .env.local — the app then runs device-only. */
export const cloudEnabled = Boolean(url && key);

let browser: SupabaseClient | null = null;

/** Browser client. Session lives in localStorage so the app opens offline. */
export function supabase(): SupabaseClient {
  if (!cloudEnabled) throw new Error("Supabase is not configured");
  browser ??= createClient(url!, key!, {
    auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return browser;
}

/** Stateless anon client for server-rendered public pages (RLS decides what is visible). */
export function supabaseServer(): SupabaseClient | null {
  if (!cloudEnabled) return null;
  return createClient(url!, key!, { auth: { persistSession: false } });
}

/** Service-role client. Server only — never import from a client component. */
export function supabaseAdmin(): SupabaseClient | null {
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;
  return createClient(url, service, { auth: { persistSession: false } });
}

export const IMAGE_BUCKET = "passages";
