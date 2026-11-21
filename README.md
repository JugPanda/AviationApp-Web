# AV Weather

Pilot-built browser preflight workspace. **Public preview; supplemental use only.**

Canonical deployment: https://aviationweather.vercel.app/ (the old GitHub homepage `aviation-app-two.vercel.app` is stale).

## Routes

- `/`: server-rendered product landing page; real captured application screenshots, no fabricated operational data.
- `/map`: existing interactive weather map, airport search and supported layers.
- `/plan`: existing route/navlog planner and browser-local saved plans.
- `/tools`: pilot calculators; W&B templates explicitly illustrative/unverified.
- `/logbook`: browser-local entries and export/import.
- `/about`: product limitations and planned direction.
- `/privacy`: browser storage, provider and request disclosure.

The original map homepage was moved intact to `/map` before its UI was refined. Installed apps retain manifest identity `/` and use `/map` as their new start URL. Existing localStorage keys and calculation formulas are preserved. An older shortcut pointing to `/` may still open the landing page until refreshed.

## Development and verification

```sh
npm ci
npm run dev
npm test
npm run lint
npm run build
npm run typecheck
npm run start -- --hostname 127.0.0.1 --port 3198
npm run test:browser
```

Browser tests default to local port 3198 and the installed Chromium executable `/snap/chromium/current/usr/lib/chromium-browser/chrome`. Set `CHROME_PATH` for another installation. Set `BASE_URL` for a deployed build and `OUTPUT_DIRECTORY` for screenshots/traces/results. Tests use isolated browser storage; they do not modify remote user records. One browser check exercises actual METAR retrieval, so a provider outage can fail it.

The browser suite checks seven routes at three widths, marketing-page accessibility, application-shell accessibility, navigation, keyboard/no-JS disclosures, local plan persistence, data-provider gates, manifest/metadata, and service-worker offline behavior. It does **not** certify every legacy calculator's accessibility or aviation accuracy. See `docs/PREVIEW-RELEASE.md` for boundaries and asset provenance.

## Provider permission gates

Public availability of an endpoint is not permission for commercial or operational use. Existing OpenSky/ADSB and RainViewer integrations remain implemented but disabled by default until required provider permissions and use restrictions have been reviewed.

Only after that review:

- `ENABLE_LICENSED_TRAFFIC=true` enables the server traffic endpoint.
- `NEXT_PUBLIC_ENABLE_LICENSED_TRAFFIC=true` exposes traffic functionality in the browser.
- `NEXT_PUBLIC_ENABLE_LICENSED_RADAR=true` enables RainViewer requests.

`NEXT_PUBLIC_` configuration is embedded at build time, so changing it requires rebuilding. Do not set these flags merely to remove notices. API traffic requests return explicit 503/unavailable while gated. Radar states that licensing is pending. Review every other map/data provider before a paid or operational release as well.

`NEXT_PUBLIC_SITE_URL` can override the canonical metadata host. Preserve the real production host, not a temporary preview URL.

## Offline and local data

There is no account service, cloud synchronization, payment integration or waitlist collection in this release. Plans, aircraft profiles, logbook entries and preferences stay in browser storage. Clearing site data can remove them. Export supported records and retain independent backups.

The service worker caches visited HTML/assets, not live API results. An offline API request receives explicit unavailable status instead of a stale response presented as live. RSC/prefetch responses are never put into the HTML cache. Activation removes only AV Weather-prefixed caches, preserving unrelated origin caches. Development mode does not register a new worker; an existing production worker on a development origin may still need to be unregistered in that isolated development browser.

## Not a full EFB replacement

No validated operational W&B, aircraft-specific dataset, complete offline charts, guaranteed briefing coverage, native mobile-store distribution, or ForeFlight sync is claimed. Built-in C172S/C182T examples are not C172N/T182T aircraft records. The founder's aircraft models do not establish any individual aircraft's empty weight, moment, equipment or limits.

Keep independent checks against applicable aircraft records, POH/AFM, authoritative current weather and regulatory requirements. Physical Samsung/iPad testing, provider rights, parser/calculator validation, operational reliability, privacy/support arrangements and pilot trials remain launch gates for a paid or cockpit-use product.
