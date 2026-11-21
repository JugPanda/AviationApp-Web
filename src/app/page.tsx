import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./landing.css";

export const metadata: Metadata = {
  title: { absolute: "AV Weather — A clearer view before you fly" },
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
        <Link href="/" className="landing-brand" aria-label="AV Weather home">
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
                Your next flight.
                <br />
                <em>A clearer view.</em>
              </h1>
              <p>
                Aviation weather, flight planning and pilot tools.
                <br className="desktop-break" /> One browser workspace. No
                particular tablet required.
              </p>
              <div className="hero-actions">
                <Link className="landing-button" href="/map">
                  Explore the workspace <Arrow />
                </Link>
                <a className="landing-text-link" href="#workspace">
                  Take a closer look <span aria-hidden="true">↓</span>
                </a>
              </div>
              <div className="hero-footnote">
                <span>Built for the browser</span>
                <span>Phone · Tablet · Desktop</span>
              </div>
            </div>
            <div className="hero-instrument" aria-hidden="true">
              <svg viewBox="0 0 400 400" fill="none">
                <circle cx="200" cy="200" r="177" />
                <circle cx="200" cy="200" r="135" />
                <circle cx="200" cy="200" r="88" />
                <path
                  d="M200 0v400M0 200h400M59 59l282 282M59 341L341 59"
                  className="instrument-guides"
                />
                {Array.from({ length: 36 }, (_, i) => (
                  <path
                    key={i}
                    d={i % 3 ? "M200 23v7" : "M200 23v14"}
                    transform={`rotate(${i * 10} 200 200)`}
                  />
                ))}
                <path
                  d="M96 275C126 267 129 174 200 200S267 123 306 109"
                  className="instrument-route"
                />
                <circle cx="96" cy="275" r="6" className="instrument-point" />
                <circle cx="306" cy="109" r="6" className="instrument-point" />
                <path
                  d="m201 170 7 32 22 10v5l-23-5v13l6 5v4l-13-4-13 4v-4l6-5v-13l-23 5v-5l22-10 7-32Z"
                  className="instrument-aircraft"
                />
              </svg>
              <span className="instrument-n">N</span>
              <span className="instrument-caption">
                A LITTLE MORE PERSPECTIVE.
              </span>
            </div>
          </div>
          <figure className="product-frame">
            <div className="product-frame-bar">
              <span>
                <i />
                <i />
                <i />
              </span>
              <span>AV WEATHER / WEATHER WORKSPACE</span>
              <span>PRODUCT PREVIEW</span>
            </div>
            <Link
              href="/map"
              aria-label="Open the weather workspace shown in this screenshot"
            >
              <picture>
                <source
                  media="(max-width: 760px)"
                  srcSet="/images/weather-workspace-mobile.webp"
                  width={390}
                  height={844}
                />
                <Image
                  src="/images/weather-workspace.webp"
                  alt="Captured AV Weather interface with airport weather and an FAA map. This screenshot is not current flight information."
                  width={1440}
                  height={900}
                  priority
                  sizes="(max-width: 760px) 100vw, 90vw"
                />
              </picture>
            </Link>
            <figcaption>
              Actual preview interface. Captured weather is not current flight
              information. Map imagery: FAA.{" "}
              <Link href="/map">
                Open current workspace <Arrow />
              </Link>
            </figcaption>
          </figure>
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
              Less switching.
              <br />
              More perspective.
            </h2>
            <p>
              Start with the weather. Work through the plan. Keep the useful
              tools close. The essentials are together, without pretending every
              feature is finished.
            </p>
          </div>
          <div className="feature-grid">
            <Link className="feature-card feature-weather" href="/map">
              <span className="feature-index">01 / OBSERVE</span>
              <div className="weather-symbol" aria-hidden="true">
                <span>VFR</span>
                <span>MVFR</span>
                <span>IFR</span>
                <span>LIFR</span>
              </div>
              <h3>See the weather picture.</h3>
              <p>
                Search an airport, read its METAR and forecast, and explore
                weather categories on the map.
              </p>
              <span className="feature-link">
                Weather map <Arrow />
              </span>
            </Link>
            <Link className="feature-card" href="/plan">
              <span className="feature-index">02 / PREPARE</span>
              <div className="route-symbol" aria-hidden="true">
                <i />
                <span />
                <i />
                <span />
                <i />
              </div>
              <h3>Give the trip a plan.</h3>
              <p>
                Build a route and navlog, work through time and fuel estimates,
                and save the plan in this browser.
              </p>
              <span className="feature-link">
                Flight planner <Arrow />
              </span>
            </Link>
            <Link className="feature-card" href="/tools">
              <span className="feature-index">03 / WORK IT THROUGH</span>
              <div className="tools-symbol" aria-hidden="true">
                W<span>+</span>B<span className="tools-rule" />
              </div>
              <h3>Keep the numbers in view.</h3>
              <p>
                Explore weight and balance, crosswind, fuel and other pilot
                calculators. Verify inputs and results independently.
              </p>
              <span className="feature-link">
                Pilot tools <Arrow />
              </span>
            </Link>
          </div>
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
          className="direction-section landing-section"
          id="direction"
          aria-labelledby="direction-title"
        >
          <div className="section-label">
            <span>02 / BUILT FROM EXPERIENCE</span>
            <span>PILOT-LED. STILL DEVELOPING.</span>
          </div>
          <div className="direction-grid">
            <div>
              <span className="eyebrow">THE IPAD ISN’T ALWAYS WITH YOU.</span>
              <h2 id="direction-title">
                Your curiosity
                <br />
                shouldn’t stop there.
              </h2>
              <p>
                AV Weather started with a familiar mismatch: an iPad for
                ForeFlight, a Samsung phone in your pocket, and a wish for a
                consistent experience across both.
              </p>
              <p>
                Built by a pilot, it’s taking shape as a cross-platform
                preflight companion. Not a claim to replace everything you
                already trust. A useful place to start—and something to help
                make better.
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
          className="questions-section landing-section"
          id="questions"
          aria-labelledby="questions-title"
        >
          <div className="section-label">
            <span>03 / BEFORE YOU OPEN IT</span>
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
            A clearer view
            <br />
            starts here.
          </h2>
          <Link className="landing-button" href="/map">
            Open the workspace <Arrow />
          </Link>
          <p>Public preview · Supplemental use only · No account required</p>
        </section>
      </main>
      <footer className="landing-footer">
        <div>
          <Link href="/" className="footer-wordmark">
            AV Weather
          </Link>
          <p>A pilot-built perspective on preflight.</p>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/about">Preview notes</Link>
          <Link href="/privacy">Privacy & data</Link>
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
