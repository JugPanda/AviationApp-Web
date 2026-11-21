import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

import PwaRegistrar from "@/components/PwaRegistrar";
import { getSiteUrl } from "@/lib/site-url";

const siteUrl = getSiteUrl();
const manrope = localFont({
  src: "../../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2",
  variable: "--font-manrope",
  weight: "200 800",
  display: "swap",
});
const dmSans = localFont({
  src: "../../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2",
  variable: "--font-dm-sans",
  weight: "100 1000",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AV Weather — Preflight workspace",
    template: "%s | AV Weather",
  },
  description:
    "A pilot-built browser workspace for aviation weather, flight planning, pilot tools and a local logbook. Supplemental-use public preview.",
  keywords: [
    "aviation weather",
    "METAR",
    "flight category",
    "VFR",
    "IFR",
    "airport weather",
    "pilot weather",
  ],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AV Weather",
  },
  openGraph: {
    title: "AV Weather",
    description:
      "A clearer view before you fly. Explore the pilot-built browser workspace.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "AV Weather — A clearer view before you fly",
      },
    ],
    type: "website",
    url: siteUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${dmSans.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
      </head>
      <body className="antialiased">
        <PwaRegistrar />
        {children}
      </body>
    </html>
  );
}
