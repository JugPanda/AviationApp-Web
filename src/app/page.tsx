import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./landing.css";
import ProductShowcase, {
  type ShowcaseItem,
} from "@/components/ProductShowcase";

export const metadata: Metadata = {
  title: { absolute: "AV Weather — Your preflight workspace" },
  description:
    "A pilot-built aviation weather and planning workspace for your browser. Explore airport weather, a route planner, pilot tools and a local logbook. Public preview.",
  alternates: { canonical: "/" },
};

const questions = [
  [
    "Does it work on my Samsung, iPad or laptop?",
    "AV Weather runs in a web browser, with layouts for phones, tablets and computers. There is no native App Store or Google Play download. Device and browser testing is ongoing during the preview.",
  ],
  [
    "Is this a replacement for ForeFlight?",
    "Not today. This is a developing preflight companion, not a full EFB or a substitute for a complete briefing, current charts, approved aircraft documents or required navigation equipment. ForeFlight is a trademark of ForeFlight LLC; AV Weather is independent and not affiliated with it.",
  ],
  [
    "Will my plans appear on all my devices?",
    "Not yet. Plans, aircraft profiles and logbook entries are saved in the browser where you create them. They do not automatically sync, including with ForeFlight. Logbook and aircraft-profile exports let you keep a separate backup.",
  ],
  [
    "Can I use the weight and balance tool for my aircraft?",
    "The built-in profiles are illustrative templates, not verified records for an individual aircraft. Any custom profile and result must be checked against that aircraft’s current weight and balance records and applicable POH/AFM. The preview is not a validated operational loading system.",
  ],
  [
    "What works without an internet connection?",
    "Previously visited pages and explicitly saved local records may remain available. Live weather requires connectivity. Offline charts, dependable in-flight navigation and complete offline briefings are not supported or promised.",
  ],
  [
    "Is there a subscription?",
    "No subscription or payment is required to explore this public preview. Paid plans have not been announced. Radar and flight-traffic feeds are held pending provider permissions; they are not part of the active preview offer.",
  ],
];

const showcase: ShowcaseItem[] = [
  {
    id: "weather",
    label: "Weather",
    title: "Start with the airport, not a wall of data.",
    description:
      "Search an ICAO code, open the airport report, and read the observation time alongside the conditions. Keep the wider map in view.",
    src: "/images/showcase-weather.webp",
    width: 1280,
    height: 800,
    mobileSrc: "/images/showcase-weather-mobile.webp",
    mobileWidth: 390,
    mobileHeight: 558,
    alt: "Actual AV Weather airport report; the desktop capture also shows the FAA map. Historical capture, not current flight information.",
    href: "/map",
    cta: "Check airport weather",
    note: "Captured interface, not live weather. Map imagery: FAA. Check freshness in the workspace.",
  },
  {
    id: "planning",
    label: "Planning",
    title: "Work through a route, one leg at a time.",
    description:
      "Enter waypoints and your own verified performance inputs. Review the navlog, then save the plan in this browser or open the print view.",
    src: "/images/showcase-planning.webp",
    width: 1280,
    height: 800,
    mobileSrc: "/images/showcase-planning-mobile.webp",
    mobileWidth: 358,
    mobileHeight: 484,
    alt: "Actual AV Weather planner showing an illustrative route and navlog. Values are demonstration inputs, not a real flight plan.",
    href: "/plan",
    cta: "Open the route planner",
    note: "Illustrative inputs only—not an actual route or aircraft record. Saved plans stay in this browser; no device sync.",
  },
  {
    id: "tools",
    label: "Pilot tools",
    title: "See the inputs behind the numbers.",
    description:
      "Explore crosswind, fuel, time and other supporting calculators. The crosswind example makes the runway and wind directions visible together.",
    src: "/images/showcase-tools.webp",
    width: 1280,
    height: 800,
    mobileSrc: "/images/showcase-tools-mobile.webp",
    mobileWidth: 358,
    mobileHeight: 424,
    alt: "Actual crosswind calculator with its illustrative default runway and wind inputs and wind diagram.",
    href: "/tools",
    cta: "Explore pilot tools",
    note: "Illustrative defaults—not current wind or aircraft limits. Verify inputs and results independently; W&B templates are unverified.",
  },
];
const feedbackUrl = "https://github.com/JugPanda/AviationApp-Web/issues/new";

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

export default function LandingPage() {
  return (
    <div className="av-landing">
      <a className="landing-skip" href="#main">
        Skip to content
      </a>
      <header className="landing-header">
        <Link
          href="/"
          className="landing-brand"
          aria-label="AV Weather / Preflight, considered. Home"
        >
          <Image src="/icon-192.png" alt="" width={38} height={38} />
          <span>
            AV Weather<span className="brand-divider"> / </span>
            <small>Preflight, considered.</small>
          </span>
        </Link>
        <nav className="landing-nav" aria-label="Main navigation">
          <a href="#workspace">The workspace</a>
          <a href="#direction">Our direction</a>
          <a href="#questions">Questions</a>
        </nav>
        <Link className="landing-nav-cta" href="/map">
          Open workspace <Arrow />
        </Link>
      </header>

      <main id="main">
        <section className="landing-hero" aria-labelledby="hero-title">
          <div className="hero-topline">
            <span>
              <i /> A PILOT-BUILT PUBLIC PREVIEW
            </span>
            <span className="hero-coordinate">
              WEATHER / PLANNING / PERSPECTIVE
            </span>
          </div>
          <div className="hero-grid">
            <div className="hero-copy">
              <h1 id="hero-title">
                Your preflight workspace.
                <br />
                <em>On the device you have.</em>
              </h1>
              <p>
                Check airport weather, work through a route and open pilot
                tools.
                <br className="desktop-break" /> In your browser, without a
                particular tablet.
              </p>
              <div className="hero-actions">
                <Link className="landing-button" href="/map">
                  Check airport weather <Arrow />
                </Link>
                <a className="landing-text-link" href="#walkthrough">
                  Watch the short tour <span aria-hidden="true">▷</span>
                </a>
              </div>
              <div className="hero-footnote">
                <span>No account required</span>
                <span>Phone · Tablet · Desktop</span>
              </div>
            </div>
            <figure className="hero-device" aria-labelledby="phone-caption">
              <div className="device-orbit" aria-hidden="true">
                <span>N</span>
              </div>
              <Link
                href="/map"
                className="phone-mockup"
                aria-label="Open AV Weather shown in the phone preview"
              >
                <span
                  className="phone-button phone-button-volume"
                  aria-hidden="true"
                />
                <span
                  className="phone-button phone-button-power"
                  aria-hidden="true"
                />
                <span className="phone-bezel">
                  <span className="phone-camera" aria-hidden="true" />
                  <span className="phone-screen">
                    <Image
                      src="/images/weather-workspace-mobile.webp"
                      alt="Actual AV Weather airport briefing displayed in a phone mockup. Captured weather is not current flight information."
                      width={390}
                      height={844}
                      priority
                      fetchPriority="high"
                      sizes="(max-width: 640px) 85vw, 390px"
                    />
                  </span>
                  <span className="phone-bottom" aria-hidden="true">
                    <i />
                  </span>
                </span>
              </Link>
              <figcaption id="phone-caption">
                <span>THE WORKSPACE. IN YOUR POCKET.</span>
                <span>Real browser preview · Illustrative device</span>
              </figcaption>
            </figure>
          </div>
          <p className="hero-capture-note">
            Actual preview interface in an illustrative device. Captured weather
            is not current flight information. Map imagery: FAA.
          </p>
        </section>

        <section
          className="workspace-section landing-section"
          id="workspace"
          aria-labelledby="workspace-title"
        >
          <div className="section-label">
            <span>01 / YOUR WORKSPACE</span>
            <span>AVAILABLE IN THE PREVIEW</span>
          </div>
          <div className="section-heading">
            <h2 id="workspace-title">
              A closer look at
              <br />
              what you can do.
            </h2>
            <p>
              Three useful places to start. Explore each part of the current
              preview—without assuming your data automatically moves between
              them.
            </p>
          </div>
          <ProductShowcase items={showcase} />
          <div className="logbook-link">
            <p>
              <strong>A place for the flights, too.</strong> Keep a
              browser-local logbook and export a separate backup.
            </p>
            <Link className="landing-text-link" href="/logbook">
              Open logbook <Arrow />
            </Link>
          </div>
        </section>

        <section
          className="walkthrough-section landing-section"
          id="walkthrough"
          aria-labelledby="walkthrough-title"
        >
          <div className="section-label">
            <span>02 / SEE IT IN USE</span>
            <span>A REAL BROWSER RECORDING</span>
          </div>
          <div className="section-heading">
            <h2 id="walkthrough-title">
              From airport search
              <br />
              to the weather picture.
            </h2>
            <p>
              A short look at the actual preview. Press play when you’re ready;
              pause, replay or use full screen to see the details.
            </p>
          </div>
          <figure className="walkthrough-player">
            <video
              controls
              playsInline
              preload="none"
              width="1280"
              height="864"
              poster="/images/walkthrough-poster.webp"
              aria-label="AV Weather airport search walkthrough"
              aria-describedby="walkthrough-caption"
            >
              <source src="/media/airport-walkthrough.mp4" type="video/mp4" />
              <track
                kind="captions"
                src="/media/airport-walkthrough.vtt"
                srcLang="en"
                label="English"
              />
              Your browser cannot play this recording.{" "}
              <a href="/media/airport-walkthrough.mp4">
                Open the walkthrough video
              </a>{" "}
              or read the steps below.
            </video>
            <figcaption id="walkthrough-caption">
              Recorded browser preview. Captured weather is not current flight
              information. Map imagery: FAA.
            </figcaption>
          </figure>
          <ol className="walkthrough-steps">
            <li>
              <span>01</span>
              <div>
                <strong>Search an airport</strong>
                <p>Enter its four-letter ICAO code. The recording uses KLOU.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Read the report</strong>
                <p>
                  Open the airport details and check the observation time with
                  the conditions.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Return to the map</strong>
                <p>Close the report to see the wider weather picture.</p>
              </div>
            </li>
          </ol>
          <Link href="/map" className="landing-text-link">
            Try an airport lookup yourself <Arrow />
          </Link>
        </section>

        <section
          className="direction-section landing-section"
          id="direction"
          aria-labelledby="direction-title"
        >
          <div className="section-label">
            <span>03 / BUILT FROM EXPERIENCE</span>
            <span>PILOT-LED. STILL DEVELOPING.</span>
          </div>
          <div className="direction-grid">
            <div>
              <span className="eyebrow">THE IPAD ISN’T ALWAYS WITH YOU.</span>
              <h2 id="direction-title">
                Your iPad isn’t always
                <br />
                the device at hand.
              </h2>
              <p>
                AV Weather began with a pilot’s everyday mismatch: using
                ForeFlight on an iPad, but sometimes having only a Samsung phone
                at hand. The goal is a useful browser companion for those
                moments.
              </p>
              <p>
                ForeFlight already does a lot well. This is not a promise to
                replace it. It’s a developing place to check the weather, work
                through planning tasks and tell us what would make it more
                useful.
              </p>
              <a
                href={feedbackUrl}
                className="landing-text-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Share feedback on GitHub <Arrow />
              </a>
              <p className="feedback-note">
                A GitHub account is required. Reports are public—please don’t
                include private flight records, personal details or credentials.
              </p>
            </div>
            <div className="direction-roadmap">
              <h3>A clear line between now and next.</h3>
              <div>
                <span className="status-tag">IN THE PREVIEW</span>
                <p>
                  Weather map, route planner, pilot calculators and a local
                  logbook.
                </p>
              </div>
              <div>
                <span className="status-tag status-next">THE DIRECTION</span>
                <p>
                  Cross-device continuity, clearer aircraft-specific setup and
                  more connected preparation.
                </p>
                <small>
                  These are development goals, not available features or
                  release-date promises.
                </small>
              </div>
              <Link className="landing-text-link" href="/about">
                Read the preview notes <Arrow />
              </Link>
            </div>
          </div>
        </section>

        <section
          className="updates-section landing-section"
          id="updates"
          aria-labelledby="updates-title"
        >
          <div className="section-label">
            <span>04 / SHIPPED, NOT PROMISED</span>
            <span>PREVIEW UPDATES</span>
          </div>
          <div className="updates-grid">
            <h2 id="updates-title">
              Small steps.
              <br />
              Real changes.
            </h2>
            <ul>
              <li>
                <time dateTime="2026-11-21">November 21, 2026</time>
                <h3>A clearer way into the workspace.</h3>
                <p>
                  Unified navigation across Map, Plan, Tools and Logbook,
                  clearer local-storage notices, and offline handling that
                  returns unavailable instead of replaying cached API weather.
                </p>
                <a href="https://github.com/JugPanda/AviationApp-Web/commit/4158630b7e0ca5dd792cef829908d230636b30cc">
                  View the shipped change <Arrow />
                </a>
              </li>
              <li>
                <time dateTime="2026-11-21">November 21, 2026</time>
                <h3>Real screens. A better first look.</h3>
                <p>
                  Phone and laptop previews built around actual AV Weather
                  captures, with responsive layouts and explicit capture labels.
                </p>
                <a href="https://github.com/JugPanda/AviationApp-Web/commit/3311c1c614e7abf8def28b3efa5667b7edd35614">
                  View the shipped change <Arrow />
                </a>
              </li>
            </ul>
          </div>
        </section>

        <section
          className="questions-section landing-section"
          id="questions"
          aria-labelledby="questions-title"
        >
          <div className="section-label">
            <span>05 / BEFORE YOU OPEN IT</span>
            <span>STRAIGHT ANSWERS</span>
          </div>
          <div className="questions-grid">
            <h2 id="questions-title">
              Know what
              <br />
              you’re opening.
            </h2>
            <div>
              {questions.map(([question, answer]) => (
                <details key={question}>
                  <summary>
                    {question}
                    <span aria-hidden="true">+</span>
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-close">
          <span className="eyebrow">START WITH A CLOSER LOOK</span>
          <h2>
            Start with
            <br />
            your airport.
          </h2>
          <Link className="landing-button" href="/map">
            Check airport weather <Arrow />
          </Link>
          <p>Public preview · Supplemental use only · No account required</p>
        </section>
      </main>
      <footer className="landing-footer">
        <div>
          <Link href="/" className="footer-wordmark">
            AV Weather
          </Link>
          <p>A pilot-built browser workspace for preflight.</p>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/about">Preview notes</Link>
          <Link href="/privacy">Privacy & data</Link>
          <a href={feedbackUrl} target="_blank" rel="noopener noreferrer">
            Feedback on GitHub
          </a>
          <Link href="/map">
            Open workspace <Arrow />
          </Link>
        </nav>
        <p className="footer-disclaimer">
          For supplemental use only. Verify weather, calculations and aircraft
          information independently. Not a complete briefing or an operational
          EFB replacement.
        </p>
      </footer>
    </div>
  );
}
