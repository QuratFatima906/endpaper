"use client";

import { useState } from "react";
import { Button, Sheet, TextArea } from "@/components/ui";

/** "Report this page" on every piece of public content (R-PUB-13). */
export function ReportLink() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function send() {
    setState("sending");
    const res = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: location.href, reason: reason.trim() }),
    }).catch(() => null);
    setState(res?.ok ? "sent" : "error");
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 hover:text-ink">
        Report this page
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Report this page">
        <h2 className="m-0 font-serif text-[26px] leading-[1.15] font-normal">Report this page</h2>
        {state === "sent" ? (
          <>
            <p className="text-[15px] leading-[1.55] text-muted">Thank you. Someone will take a look.</p>
            <Button onClick={() => setOpen(false)}>Close</Button>
          </>
        ) : (
          <>
            <p className="text-[15px] leading-[1.55] text-muted">Tell us what’s wrong, if you like. The page address is sent with your note; nothing about you is.</p>
            <TextArea label="What’s wrong? (optional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1999} minRows={3} />
            {state === "error" && (
              <p role="alert" className="text-[13px] text-accent">
                Couldn’t send that. Please try again.
              </p>
            )}
            <div className="flex flex-col gap-3 md:flex-row-reverse">
              <Button onClick={send} disabled={state === "sending"} className="md:flex-1">
                Send report
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)} className="md:flex-1">
                Cancel
              </Button>
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}
