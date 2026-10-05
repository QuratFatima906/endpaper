// OWNER: have this reviewed before launch
import type { Metadata } from "next";
import { AccountFrame } from "@/components/account-frame";
import { BackLink } from "@/components/ui";

export const metadata: Metadata = { title: "Terms" };

export default function Terms() {
  return (
    <AccountFrame prose>
      <BackLink href="/">Back</BackLink>
      <article className="mt-6 flex flex-col gap-4 text-[15px] leading-[1.6] [&_h2]:mt-4 [&_h2]:font-serif [&_h2]:text-[22px] [&_ul]:list-disc [&_ul]:pl-5">
        <h1 className="font-serif text-4xl leading-[1.1]">Terms</h1>
        <p className="font-serif text-lg italic">Plain terms for a quiet place to keep what you read.</p>

        <h2>Your content stays yours</h2>
        <p>You own what you write and the photos you take. We only store and show it so the app can work for you, and on your public page when you choose to share it.</p>

        <h2>Sharing responsibly</h2>
        <ul>
          <li>Short quoted passages with your own thoughts are fine. Please don&apos;t publish whole chapters or other people&apos;s work at length.</li>
          <li>Don&apos;t post anything unlawful, hateful or that harms others. We may take down public pages that do, and anyone can report a public page.</li>
        </ul>

        <h2>Your account</h2>
        <ul>
          <li>Keep access to your email safe; it is how you sign in.</li>
          <li>You can export everything or delete your account whenever you like, from Settings.</li>
        </ul>

        <h2>The service</h2>
        <p>Endpaper has no ads and doesn&apos;t sell your data. We work hard to keep it running and your data safe, and keep a copy on your device, but please export a backup now and then. If we ever need to close the service, we&apos;ll give you notice and time to take your data with you.</p>

        <h2>Changes</h2>
        <p>If these terms change in a way that matters, we&apos;ll tell you in the app first.</p>
        <h2>Contact</h2>
        <p>
          Questions about these terms? Email{" "}
          <a href="mailto:quratfatima581@gmail.com" className="text-accent underline">
            quratfatima581@gmail.com
          </a>
          .
        </p>
      </article>
    </AccountFrame>
  );
}
