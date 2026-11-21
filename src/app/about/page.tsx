import type { Metadata } from "next";
import Link from "next/link";
import "../landing.css";
export const metadata: Metadata = {
  title: "Preview notes",
  alternates: { canonical: "/about" },
};
export default function AboutPage() {
  return (
    <div className="av-landing">
      <main className="landing-legal">
        <Link href="/">← AV Weather</Link>
        <h1 style={{ marginTop: 32 }}>
          A useful beginning.
          <br />
          An honest preview.
        </h1>
        <p>
          AV Weather is a pilot-built browser workspace for aviation weather,
          flight planning, pilot calculators and a local logbook. Its direction
          comes from a practical problem: the iPad you usually use is not always
          the device you have with you.
        </p>
        <h2>What you can explore</h2>
        <p>
          The weather map, route planner, calculator collection and local
          logbook are available now. The application is a developing
          supplemental tool, not a validated replacement for a complete
          briefing, current charts, approved aircraft documentation or required
          equipment.
        </p>
        <h2>What is not ready</h2>
        <p>
          There is no automatic cross-device sync, ForeFlight integration,
          native mobile-store app, flight-plan filing or complete offline chart
          package. Do not rely on the preview for in-flight navigation or
          operational loading decisions. A successful calculation is not a
          determination that a flight is safe.
        </p>
        <h2>Aircraft data matters</h2>
        <p>
          Built-in weight-and-balance profiles are illustrative and unverified.
          A model name does not establish the empty weight, moment,
          configuration or limits of your individual aircraft. Use current
          aircraft-specific records and the applicable POH/AFM, and
          independently verify all inputs and results. C172S and C182T templates
          are not substitutes for C172N or T182T records.
        </p>
        <h2>Sources and availability</h2>
        <p>
          Weather requests use AviationWeather.gov; some airport, chart and map
          layers use additional third-party sources. Check the source and
          issuance time of every report. Missing information, incomplete
          coverage or a failed feed must not be interpreted as clear conditions.
          Internet-delivered radar is not for tactical thunderstorm avoidance.
        </p>
        <p>
          Radar and flight-traffic integrations are currently held pending
          confirmation of provider permissions. Public API access is not
          necessarily permission to use a feed in a commercial service.
        </p>
        <h2>Local means this browser</h2>
        <p>
          Plans, logbook entries and aircraft profiles stay in local browser
          storage, not an account. Clearing site data can remove them. Keep
          separate exports of your logbook and profiles; do not use this preview
          as your only required record.
        </p>
        <h2>Where it goes next</h2>
        <p>
          Cross-device continuity, clearer aircraft setup and more connected
          preparation are development goals. They are not shipped capabilities
          or release-date commitments. ForeFlight is a trademark of ForeFlight
          LLC. AV Weather is independent and is not affiliated with or endorsed
          by ForeFlight.
        </p>
        <Link className="landing-button" href="/map">
          Explore the workspace ↗
        </Link>
        <p>
          <Link href="/privacy">Privacy & data notes</Link>
        </p>
      </main>
    </div>
  );
}
