"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { clearLocal, db, getMeta, setMeta } from "./db";
import { now, setUserId } from "./repo";
import { cloudEnabled, supabase } from "./supabase";
import { startSync, syncNow } from "./sync";
import type { Profile } from "./types";

type User = { id: string; email: string };
type Session = {
  ready: boolean;
  user: User | null;
  profile: Profile | null | undefined; // undefined = still loading
};

const Ctx = createContext<Session>({ ready: false, user: null, profile: undefined });
export const useSession = () => useContext(Ctx);

const LOCAL_USER = "local-user";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!cloudEnabled) {
      // Device-only mode (no Supabase configured yet): one local account.
      void getMeta<User>(LOCAL_USER).then((u) => {
        if (u) setUserId(u.id);
        setUser(u ?? null);
        setReady(true);
      });
      return;
    }
    const sb = supabase();
    const apply = (u: { id: string; email?: string } | null | undefined) => {
      if (u) {
        setUserId(u.id);
        setUser({ id: u.id, email: u.email ?? "" });
        startSync();
      } else setUser(null);
      setReady(true);
    };
    // getSession reads localStorage, so this resolves offline too.
    void sb.auth.getSession().then(({ data }) => apply(data.session?.user));
    const { data } = sb.auth.onAuthStateChange((_e, s) => apply(s?.user));
    return () => data.subscription.unsubscribe();
  }, []);

  // Tag the result with its user id: after `user` changes, useLiveQuery briefly returns the
  // previous result, which must read as "loading", not "no profile" (that caused a redirect).
  const q = useLiveQuery(async () => ({ uid: user?.id, row: user ? ((await db.profiles.get(user.id)) ?? null) : null }), [user?.id]);
  const profile = q && q.uid === user?.id ? q.row : undefined;

  // Theme + text size follow the profile (R-A11Y-7, R-A11Y-9).
  useEffect(() => {
    const el = document.documentElement;
    const theme = profile?.theme ?? "system";
    if (theme === "system") el.removeAttribute("data-theme");
    else el.dataset.theme = theme;
    el.dataset.text = profile?.text_size ?? "m";
  }, [profile?.theme, profile?.text_size]);

  return <Ctx.Provider value={{ ready, user, profile: user ? profile : null }}>{children}</Ctx.Provider>;
}

/** Wrap every editor route. Redirects logged-out visitors to sign-in (T11). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, user, profile } = useSession();
  const router = useRouter();
  const [checkedRemote, setCheckedRemote] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) return router.replace("/");
    if (profile === null && !checkedRemote) {
      // New device: pull first so an existing username is not asked for again.
      void syncNow().finally(() => setCheckedRemote(true));
    } else if (profile === null && checkedRemote) router.replace("/username");
  }, [ready, user, profile, checkedRemote, router]);

  if (!ready || !user || !profile?.username) return null;
  return <>{children}</>;
}

// ---- auth actions -------------------------------------------------------

const redirect = () => `${window.location.origin}/auth/callback`;

export async function sendMagicLink(email: string) {
  if (!cloudEnabled) {
    // Device-only: sign straight in; nothing is sent anywhere.
    const u = { id: crypto.randomUUID(), email };
    await setMeta(LOCAL_USER, u);
    window.location.assign("/username");
    return;
  }
  const { error } = await supabase().auth.signInWithOtp({ email, options: { emailRedirectTo: redirect() } });
  if (error) throw error;
}

export async function signInWithGoogle() {
  if (!cloudEnabled) throw new Error("Google sign-in needs Supabase to be configured.");
  const { error } = await supabase().auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirect() } });
  if (error) throw error;
}

/** Signs out and wipes this device, after pushing anything still unsynced. */
export async function signOut(everywhere = false) {
  if (cloudEnabled) {
    await syncNow();
    await supabase().auth.signOut({ scope: everywhere ? "global" : "local" });
  }
  await clearLocal();
  window.location.assign("/");
}

export async function createProfile(user: User, username: string) {
  const t = now();
  await db.profiles.put({
    id: user.id,
    username,
    display_name: "",
    bio: "",
    profile_hidden: false,
    theme: "system",
    text_size: "m",
    created_at: t,
    updated_at: t,
    deleted_at: null,
    _dirty: 1,
  });
  await syncNow();
}

export const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

/** Null = available; string = reason it cannot be used. Needs network in cloud mode. */
export async function checkUsername(name: string, selfId?: string): Promise<string | null> {
  if (!USERNAME_RE.test(name)) return "3–24 characters: lowercase letters, numbers, underscores.";
  if (!cloudEnabled) return null;
  const { data, error } = await supabase().rpc("username_available", { name, self: selfId ?? null });
  if (error) return "Couldn't check right now. Are you online?";
  return data ? null : "That one is taken.";
}
