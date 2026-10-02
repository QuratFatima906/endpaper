import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, IBM_Plex_Mono, Kalam, Newsreader } from "next/font/google";
import { PaperGrain, RoughDefs } from "@/components/ui";
import { ServiceWorker } from "@/components/service-worker";
import { SessionProvider } from "@/lib/session";
import "./globals.css";

// next/font self-hosts these at build time, so type still renders offline.
const newsreader = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], weight: ["400", "500"], variable: "--font-newsreader" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-hanken" });
const kalam = Kalam({ subsets: ["latin"], weight: "400", variable: "--font-kalam" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: "400", variable: "--font-plex-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Endpaper", template: "%s · Endpaper" },
  description: "A memory lane for the books that stayed with you.",
  applicationName: "Endpaper",
  appleWebApp: { capable: true, title: "Endpaper", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF9F6" },
    { media: "(prefers-color-scheme: dark)", color: "#17181B" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${newsreader.variable} ${hanken.variable} ${kalam.variable} ${plexMono.variable}`}>
      <body>
        <RoughDefs />
        <PaperGrain />
        <SessionProvider>{children}</SessionProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
