import type { Metadata } from "next";
import Link from "next/link";
import "../landing.css";
export const metadata: Metadata = {
  title: "Privacy & data",
  alternates: { canonical: "/privacy" },
};
export default function PrivacyPage() {
  return (
    <div className="av-landing">
      <main className="landing-legal">
        <Link href="/">← AV Weather</Link>
        <h1 style={{ marginTop: 32 }}>
          Your browser.
          <br />
          Your local records.
        </h1>
        <p>
          These notes describe the current public preview. There is no account
          signup, payment checkout, waitlist form or added advertising/analytics
          tracker in this release.
        </p>
        <h2>What is stored on your device</h2>
        <p>
          The application saves flight plans, logbook entries, aircraft
          profiles, calculator preferences and recent airport briefings in
          browser storage. A service worker can cache previously visited pages
          and assets. These records do not automatically sync to other devices.
          Export logbook entries and aircraft profiles before clearing site
          data. Clearing this site’s browser storage removes locally saved
          records and preferences.
        </p>
        <h2>Requests and third parties</h2>
        <p>
          Visiting the site sends normal requests to our hosting provider,
          Vercel, which may process IP addresses and request logs for delivery
          and security. Airport codes and other queries are sent to the site’s
          API and relevant data providers. Map tiles load from third parties,
          which can receive your IP address and the map areas requested. See
          attribution within the map for the selected source.
          AviationWeather.gov supplies weather data; FAA and other map services
          supply chart layers.
        </p>
        <p>
          Radar and traffic integrations are disabled by default pending
          provider permission review. If enabled in a later release, additional
          provider data practices and terms will apply.
        </p>
        <h2>Location</h2>
        <p>
          If you choose a locate-me control, your browser asks for location
          permission. You can deny or revoke it in browser settings. Map-area
          requests may reveal an approximate area of interest to tile providers.
        </p>
        <h2>Backups and sensitive information</h2>
        <p>
          Keep your own backups. Browser storage is not a secure vault or a
          guaranteed permanent record. Avoid adding information you do not need
          for the task, and protect exported files yourself. Do not share
          aircraft records or another person’s information without permission.
        </p>
        <h2>Preview limitations</h2>
        <p>
          There is no verified cloud account deletion or support-inbox workflow
          in this release, so we do not offer an unimplemented request form. The
          privacy and retention arrangements will need review before accounts,
          synchronization, payments or new data collection are introduced.
        </p>
        <p>
          <Link href="/about">Read the product limitations</Link> ·{" "}
          <Link href="/map">Open workspace</Link>
        </p>
      </main>
    </div>
  );
}
