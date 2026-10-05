// OWNER: have this reviewed before launch
import type { Metadata } from "next";
import { AccountFrame } from "@/components/account-frame";
import { BackLink } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <AccountFrame prose>
      <BackLink href="/">Back</BackLink>
      <article className="mt-6 flex flex-col gap-4 text-[15px] leading-[1.6] [&_h2]:mt-4 [&_h2]:font-serif [&_h2]:text-[22px] [&_ul]:list-disc [&_ul]:pl-5">
        <h1 className="font-serif text-4xl leading-[1.1]">Privacy</h1>
        <p className="font-serif text-lg italic">Short version: your reading is yours. It stays private unless you choose to share it.</p>

        <h2>What we keep</h2>
        <ul>
          <li>Your email address, so you can sign in.</li>
          <li>Your username, and a name and bio if you add them.</li>
          <li>What you make here: books, passages, photos, notes, check-ins, reflections, essays and pages.</li>
        </ul>

        <h2>Signing in with Google</h2>
        <p>
          If you choose Google, we receive your name, email address and profile picture from your Google account. We use only your email address, to create
          your account and sign you in. We don&apos;t read your Gmail, contacts, Drive or anything else, and we don&apos;t share Google account data with
          anyone. Our use of information from Google follows the Google API Services User Data Policy, including its Limited Use requirements.
        </p>

        <h2>Private by default</h2>
        <p>Everything starts private. Nothing appears on your public page until you choose to share it, book by book. You can take it down again at any time.</p>
        <p>Photos are stored in private storage that only your account can read. We strip location and camera details from photos before they are saved.</p>

        <h2>What we don&apos;t do</h2>
        <ul>
          <li>No ads.</li>
          <li>We never sell or rent your data, or use it to profile you.</li>
          <li>No tracking cookies and no analytics that identify you.</li>
        </ul>

        <h2>Who helps us run it</h2>
        <p>Your data is stored with our hosting and database providers, who process it only on our behalf. If you look up a book, its title or ISBN is sent to a public book catalogue to find the cover and details.</p>

        <h2>Your rights</h2>
        <p>Under UK GDPR you can see, correct, export or delete your data, and object to how we use it.</p>
        <ul>
          <li>Export everything at any time from Settings → Export everything.</li>
          <li>Delete your account from Settings → Delete account. This removes your data and photos for good, and your public pages stop working straight away.</li>
        </ul>
        <p>If you&apos;re unhappy with how we handle your data, you can complain to the Information Commissioner&apos;s Office (ico.org.uk).</p>
        <h2>Contact</h2>
        <p>
          Questions about your data, or want to use one of your rights? Email{" "}
          <a href="mailto:quratfatima581@gmail.com" className="text-accent underline">
            quratfatima581@gmail.com
          </a>
          .
        </p>
      </article>
    </AccountFrame>
  );
}
