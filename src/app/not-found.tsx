import Link from "next/link";
import { Logo } from "@/components/ui";

// Also what visitors see after a book is made private, an essay is taken down,
// or an account is deleted (T8) — deliberately indistinguishable from "never existed".
export default function NotFound() {
  return (
    <main className="relative z-[1] flex min-h-dvh flex-col items-center justify-center gap-[18px] px-6 text-center">
      <Logo size={54} word={false} />
      <h1 className="m-0 font-serif text-[36px] leading-[1.1] font-normal md:text-[44px]">This page isn’t here</h1>
      <p className="max-w-[440px] text-[17px] leading-normal text-muted">It may have been made private or removed by its owner.</p>
      <Link href="/" className="inline-flex min-h-11 items-center text-[15px] underline">
        Go to Endpaper
      </Link>
    </main>
  );
}
