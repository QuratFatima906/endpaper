"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui";
import { signInWithGoogleToken } from "@/lib/session";

// Google Identity Services button. The popup runs on our origin, so Google shows our
// domain instead of the Supabase project URL that the OAuth redirect flow exposes.
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const SRC = "https://accounts.google.com/gsi/client";

type Gis = {
  accounts: {
    id: {
      initialize(o: { client_id: string; nonce: string; callback: (r: { credential: string }) => void; use_fedcm_for_button?: boolean }): void;
      renderButton(el: HTMLElement, o: Record<string, string | number>): void;
    };
  };
};

function loadGis(): Promise<Gis> {
  const w = window as unknown as { google?: Gis };
  if (w.google?.accounts) return Promise.resolve(w.google);
  return new Promise((resolve, reject) => {
    const s = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`) ?? document.head.appendChild(Object.assign(document.createElement("script"), { src: SRC, async: true }));
    s.addEventListener("load", () => resolve(w.google!));
    s.addEventListener("error", () => reject(new Error("Couldn't reach Google. Are you online?")));
  });
}

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Signs in on success (onAuthStateChange picks it up); `onError` must be stable, e.g. a state setter. */
export function GoogleButton({ onError }: { onError: (msg: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let live = true;
    const nonce = crypto.randomUUID();
    Promise.all([loadGis(), sha256Hex(nonce)])
      .then(([g, hashed]) => {
        if (!live || !ref.current) return;
        g.accounts.id.initialize({
          client_id: CLIENT_ID,
          nonce: hashed,
          use_fedcm_for_button: true,
          callback: (r) => {
            onError(null);
            signInWithGoogleToken(r.credential, nonce).catch((e: Error) => onError(e.message || "Couldn't sign in with Google. Are you online?"));
          },
        });
        g.accounts.id.renderButton(ref.current, { type: "standard", size: "large", text: "continue_with", width: Math.min(400, ref.current.offsetWidth) });
      })
      .catch((e: Error) => live && onError(e.message));
    return () => {
      live = false;
    };
  }, [onError]);

  if (!CLIENT_ID) return null;
  // Google's own button switches to a "Continue as <name>" layout we can't restyle, so it sits
  // invisibly over ours and takes the click. Scaled up so its 44px frame covers the whole button.
  return (
    <div className="relative rounded-[27px] focus-within:outline-2 focus-within:outline-offset-3 focus-within:outline-accent">
      <Button variant="outline" tabIndex={-1} aria-hidden className="w-full md:h-12">
        <span className="inline-flex items-center gap-3">
          <GoogleG />
          Continue with Google
        </span>
      </Button>
      <div ref={ref} className="absolute inset-0 flex items-center justify-center overflow-hidden opacity-0 [&_iframe]:scale-[1.3]" />
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
