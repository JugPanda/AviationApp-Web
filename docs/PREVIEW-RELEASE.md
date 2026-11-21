# Premium preview release

## Approved scope and positioning

Jug authorized a premium upgrade and a landing page. AV Weather remains a pilot-built, cross-platform browser preflight companion, not a full ForeFlight replacement. The primary benefit is access across device types; automatic record synchronization is not implemented or claimed. No specific certificate level, flight hours, customers, endorsements or revenue have been invented.

## Delivered surfaces

Server-rendered landing, application entry at `/map`, shared Map/Plan/Tools/Logbook shell, local-storage and supplemental-use disclosure, keyboard/native FAQ, privacy and preview notes, coherent social metadata and updated installed-app entry. Existing compass/airplane identity and flight-category semantics retained. Decorative route illustration is SVG geometry, not an actual flight plan. No image-generation service or new brand/logo concept used.

## Asset provenance

`public/images/weather-workspace.webp` and `weather-workspace-mobile.webp` are real local production-mode captures of this application after a KLOU lookup. Data came from real providers; no responses were fabricated or intercepted for these assets. They are static historical captures, explicitly captioned as not current flight information. FAA chart imagery retains visible/page attribution. The mobile capture uses a 390×844 CSS-pixel viewport at 3× device scale (1170×2532 source pixels). Source PNG and capture evidence are outside the repository under the active profile's `reports/avweather/`. Do not describe these images as live weather.

Device presentation: original, brand-neutral CSS phone and laptop mockups frame those real screenshots. Metallic edges, camera/side-button geometry, shadows and background rings are decorative illustrations, not photographs or claims of native-app distribution. No third-party mockup pack, hardware trademark, stock photography, paid asset or generated screen was used. The phone composition remains visible on mobile; the larger laptop composition is shown on tablet/desktop. Both link to the actual browser workspace.

Typography: self-hosted Manrope and DM Sans via Fontsource, with OFL notices retained in `public/licenses/`. Existing app icons were preserved. No competitor logos, code, charts or proprietary aircraft profiles were copied. REA was not installed: the task did not require reverse engineering.

## Preservation and security

Baseline SHA: `540eaf2862dfac00e2508db1d7ccfe6221627d8c`. The original map route was copied before replacement of the homepage. Plan/logbook/profile keys and calculator formulas retained; no database migrations or production-record writes. The upgrade corrects hydration/React component issues, clarifies illustrative W&B data, and adds source/regression tests. Data route annotations do not constitute runtime provider-schema validation.

Next.js and compatible dependencies were patched. The original installed npm resolver failed during audit remediation; npm 11.6.2 completed compatible remediation without a forced major upgrade. Final audit and exact release results belong in the delivery evidence, not assumed from the dependency edit.

## Known limits and publication boundaries

- Current weather and map features rely on network/provider availability. Legacy hazard parsing, TAF interpretation, chart currency, airport ingestion and calculator behavior require a dedicated operational-readiness audit; UI verification does not establish their accuracy or completeness.
- Built-in aircraft templates remain illustrative/unverified. No operational C172N or T182T configuration has been created.
- OpenSky/ADSB and RainViewer paths are permission-gated. Required agreements were not inferred from API access. Other provider rights also need confirmation before commercialization.
- Offline capability is limited to visited assets/local records. Live API responses are not replayed from cache. Browser storage is not guaranteed durable or backed up.
- No accounts, cloud sync, payments, waitlist form or unverified contact endpoint were introduced.
- Automated mobile checks use Chromium emulation. Physical Samsung/iPad/Safari certification is not claimed.
- Vercel MCP read was denied for this team's scope. Git deployment status and public runtime/asset checks can verify release independently; do not disable deployment protection or alter credentials to bypass this.

## Rollback considerations

The predecessor source SHA above and its Vercel deployment `dpl_9U3DBY6iHmczoWLoQeqAK4KNHXDk` identify the prior release. A full rollback would remove the landing page, route migration, navigation improvements, dependency fixes, clearer W&B warnings and provider gates. Prefer a focused visual revision rather than restoring the entire older state. Local record keys are unchanged; retain independent backups regardless.
