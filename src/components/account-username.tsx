"use client";

import { useEffect, useId, useState } from "react";
import { RoughBorder } from "@/components/ui";
import { cx } from "@/lib/cx";
import { checkUsername } from "@/lib/session";

export type Check = { state: "idle" | "checking" | "ok" | "bad"; message?: string; name?: string };

// The site's own host (no domain is registered yet, so never hardcode one).
const HOST = typeof window === "undefined" ? "" : window.location.host;

/** Debounced availability check. `current` = the user's own name (always fine). */
export function useUsernameCheck(name: string, selfId?: string, current?: string): Check {
  const [check, setCheck] = useState<Check>({ state: "idle" });
  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      if (!name || name === current) return live && setCheck({ state: "idle" });
      setCheck({ state: "checking" });
      const reason = await checkUsername(name, selfId);
      if (live) setCheck(reason ? { state: "bad", message: reason, name } : { state: "ok", name });
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [name, selfId, current]);
  // A result only counts for the name it was checked against (typing moves on).
  return check.name === undefined || check.name === name ? check : { state: "checking" };
}

export function UsernameField({ value, onChange, check, className, autoFocus }: { value: string; onChange: (v: string) => void; check: Check; className?: string; autoFocus?: boolean }) {
  const id = useId();
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="sr-only">
        Username
      </label>
      <div className="relative flex h-[52px] items-center px-4 text-[17px]">
        <RoughBorder radius={12} color={value ? "var(--accent)" : "var(--field)"} width={value ? 2 : 1.5} />
        <span className="relative text-muted" aria-hidden="true">
          {HOST}/@
        </span>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase().replace(/\s/g, ""))}
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={24}
          aria-describedby={`${id}-s`}
          aria-invalid={check.state === "bad"}
          className="relative h-full min-w-0 flex-1 bg-transparent outline-none"
        />
      </div>
      <p id={`${id}-s`} aria-live="polite" className={cx("min-h-6", check.state === "ok" ? "font-hand text-base text-accent" : "text-[13px] text-muted")}>
        {check.state === "ok" ? "✓ available" : check.state === "checking" ? "checking…" : check.state === "bad" ? check.message : ""}
      </p>
    </div>
  );
}
