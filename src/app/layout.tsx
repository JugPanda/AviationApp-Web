import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f172a",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Aviation Weather - Real-time METAR & Flight Categories",
  description: "View real-time airport weather conditions, METARs, and flight categories (VFR, MVFR, IFR, LIFR) on an interactive map. Free aviation weather app.",
  keywords: ["aviation weather", "METAR", "flight category", "VFR", "IFR", "airport weather", "pilot weather"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Aviation Weather",
  },
  openGraph: {
    title: "Aviation Weather",
    description: "Real-time METAR & Flight Categories",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
