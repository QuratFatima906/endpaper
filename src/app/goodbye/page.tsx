import type { Metadata } from "next";
import { AccountFrame } from "@/components/account-frame";
import { ButtonLink, Logo } from "@/components/ui";

export const metadata: Metadata = { title: "Account deleted", robots: { index: false } };

export default async function Goodbye({ searchParams }: PageProps<"/goodbye">) {
  const { emailed } = await searchParams;
  return (
    <AccountFrame>
      <div className="mt-[max(80px,24dvh)] flex flex-col gap-4 md:mt-0">
        <Logo size={36} word={false} className="md:hidden" />
        <h1 className="font-serif text-[34px] leading-[1.1] md:text-[44px]">Your account is gone</h1>
        <p className="text-[15px] leading-[1.55] text-muted">
          Everything has been deleted, including your photos and public pages.
          {emailed === "1" && " We've sent a confirmation to your email."}
        </p>
        <p className="mt-[6px] font-hand text-lg text-accent">thanks for reading with us</p>
      </div>
      <ButtonLink href="/" variant="outline" className="mt-auto md:mt-8 md:h-12 md:self-start">
        Back to the start
      </ButtonLink>
    </AccountFrame>
  );
}
