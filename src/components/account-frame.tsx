import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui";

/** Quiet single-column frame for sign-in steps, goodbye and legal pages. Logo top-left on desktop. */
/** `prose`: long reading pages (legal) sit just under the logo instead of low on the page. */
export function AccountFrame({ children, prose }: { children: ReactNode; prose?: boolean }) {
  return (
    <div className="relative z-[1] flex min-h-dvh flex-col">
      <header className="hidden px-10 py-7 md:block">
        <Link href="/" aria-label="Endpaper, start">
          <Logo />
        </Link>
      </header>
      <main className={`mx-auto flex w-full max-w-[520px] flex-1 flex-col px-7 pt-[calc(env(safe-area-inset-top)+62px)] pb-[calc(env(safe-area-inset-bottom)+44px)] md:px-0 ${prose ? "md:pt-4" : "md:pt-[120px]"}`}>
        {children}
      </main>
    </div>
  );
}
