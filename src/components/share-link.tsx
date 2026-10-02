"use client";

import { useState } from "react";
import { RoughBorder } from "@/components/ui";

/** Read-only share link with a Copy button (share sheet and published essay). */
export function LinkBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative flex h-[52px] items-center justify-between gap-3 pl-4 text-sm">
      <RoughBorder radius={12} />
      <span className="relative truncate text-muted">{url.replace(/^https?:\/\//, "")}</span>
      <button type="button" onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true))} className="relative min-h-11 px-4 font-medium text-accent" aria-live="polite">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
