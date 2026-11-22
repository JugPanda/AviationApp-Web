# NOTAM integration decision and aviation-validation boundary

Research checked **2026-11-22 UTC**, against repository base `9526b34` (`main`). Scope: read-only provider investigation; this document is the only repository file written by this task. No accounts, access requests, purchases, credentials, application changes, commits, or deployments were made.

## Decision

**Do not enable a replacement NOTAM provider yet. No immediately usable, credential-free, explicitly authorized API suitable for this public application was established from the official sources reviewed.** This is a bounded research conclusion, not a claim that no such service can exist anywhere.

The preferred next step is to request the **FAA NMS distribution API** documentation and permission directly from FAA. If FAA cannot approve the intended public/pilot-facing use, obtain a **Cirium Laminar NOTAM contract** explicitly covering the application's display, geographic coverage, caching, and redistribution. Autorouter is another documented integration, but requires API approval and clarification of public redistribution rights; an individual account is not evidence of a site-wide license.

Until then, keep the existing explicit unavailable response. A successful empty list must mean a valid, complete query returned no notices, never that authentication, coverage, schema validation, or an endpoint failed. No unsupported FAA NOTAM-search internals or scraping are recommended.

## Existing implementation and configuration evidence

- `src/app/api/notam/[icao]/route.ts` calls `https://aviationweather.gov/api/data/notam?icao=...&format=json`, with a 600-second Next.js revalidation interval. It assumes a bare array and guesses several alternative text/date field names. These are not an established NOTAM provider contract.
- The route correctly returns HTTP 503 with `{ notams: [], unavailable: true, message: ... }` on upstream failure. Its current keyword categories/severity and date-only `isActive` calculation are app heuristics, not authoritative NOTAM interpretation. Missing/invalid dates can currently appear active; schedule, cancellation, replacement, and permanent/estimated-end semantics need a real adapter.
- `src/components/AirportInfo.tsx` separately tracks NOTAM retrieval and warns when unavailable; `tests/weather-api-reliability.test.ts` and `tests/briefing-freshness.test.ts` contain reliability regressions. This investigation read these references but did not rerun tests or certify deployed behavior.
- A local scan found **no `.env*` files** outside dependency/build/git/test-output directories, and no relevant process-variable names containing FAA, NOTAM, SWIM, LAMINAR, AVIATION, or AUTOROUTER. No environment values were printed. Source inspection found no NOTAM provider credential configuration. Existing unrelated feature-gate names include `ENABLE_LICENSED_TRAFFIC`, `NEXT_PUBLIC_ENABLE_LICENSED_TRAFFIC`, and `NEXT_PUBLIC_ENABLE_LICENSED_RADAR`.
- This does **not** establish whether the owner's Vercel account or a separate secret store contains credentials; neither was inspected. Tool login state is not FAA/provider authorization.

### AWC is not a supported NOTAM source

Official sources opened:

- [AWC Data API products and usage](https://aviationweather.gov/data/api/)
- [AWC OpenAPI schema](https://aviationweather.gov/data/schema/openapi.yaml)

The product list and OpenAPI paths contain weather/navigation products but no NOTAM endpoint. A bounded unauthenticated GET of `https://aviationweather.gov/api/data/notam?icao=KJFK&format=json` returned **HTTP 404**; the OpenAPI document returned **HTTP 200**. Therefore AWC's documented public API does not offer this integration. This does not assert anything about undisclosed NOAA systems. AWC defines 404 as endpoint/item not found, not “no NOTAMs.”

## Provider options and authorization gates

### 1. FAA NOTAM Management Service (NMS) — preferred first inquiry

Sources read:

- [NMS portal, API Access and expanded access FAQ](https://nms.aim.faa.gov/)
- [FAA NOTAM modernization program](https://www.faa.gov/about/initiatives/notam)

The live NMS FAQ states: **“Please contact us at notams@faa.gov to request access to the new NMS-API.”** Its “Get API Access and Documentation” link is `mailto:NOTAMS@faa.gov`.

**Access:** onboarding is required; anonymous consumption was not offered in the public material reviewed. The public portal does not establish an authentication protocol, production base URL, query endpoint, pagination contract, or response schema. Do not invent `client_id`/`client_secret` headers or reuse legacy FAA API examples as an NMS contract.

**Commercial/public reuse:** the reviewed pages do not grant this application's redistribution, public display, offline retention, or operational-use rights, nor publish pricing or rate limits. These are unresolved permission questions, not evidence that FAA prohibits all commercial use. Obtain the actual service agreement and a written scope decision.

**Currency caution:** the modernization page still describes a planned late-Spring-2026 deployment; the portal displayed metrics dated April 2026. Neither establishes present cutover completion, production entitlement, or legacy endpoint longevity. Ask NMS for current production migration guidance.

**Endpoint/schema deliverable blocked:** FAA must provide the current distribution API specification, auth requirements, example responses, field semantics, quotas, and completeness/reconciliation mechanism. No protected endpoint was probed.

### 2. FAA SWIM/SCDS — not a drop-in public briefing REST API

Sources read:

- [SWIM Questions & Answers](https://www.faa.gov/air_traffic/technology/swim/questions_answers)
- [SCDS General Guideline with Standards v1.1, September 11, 2024](https://www.faa.gov/sites/faa.gov/files/air_traffic/technology/swim/governance/SCDS-Guideline-Document_v1.1_09.11.2024)

FAA describes SCDS as publicly accessible Solace JMS distribution; **publicly accessible does not mean anonymous or unrestricted**. The guideline refers to subscriber accounts, provisioning subscriptions through the SWIFT portal, a Service Access Agreement, mandatory compression, and JMS requirements/exceptions. It explicitly says SCDS does not provide web/request-reply services. FAA says SWIM data currently has no data charge; consumers bear interface costs. Free data is not a commercial reuse clearance.

Most importantly, §2.1.1 says users **MUST NOT use SCDS data for NAS-impacting purposes**. The definitions include services to pilots affecting operational situational awareness as NAS-impacting; non-NAS-impacting examples exclude use in pilot/airline operations. The guideline also says it should not be the sole source for aviation-safety activities. A disclaimer alone does not resolve whether this application's intended use is permitted.

**Recommendation:** do not treat SCDS as a free shortcut for this pilot-facing app. Ask FAA which NMS/SWIM distribution path and agreement permit the actual use; request an approved exception or another service if needed. Current NOTAM subscription/topic/schema and its NMS-transition status were not established here. A streaming option would require a persistent ingestion worker, durable reconciled store, and server query layer, not a JMS connection per Vercel request. Public display/redistribution remains a separate approval question; the guideline's *internal* redistribution rules are not a blanket public license.

### 3. Cirium Laminar NOTAM Data v2 — documented commercial REST alternative

Sources read:

- [Current NOTAM API reference](https://developer.cirium.com/apis/laminar-data-hub/notam) — rendered endpoints plus the page's embedded public OpenAPI server declaration
- [Detailed v2 field semantics](https://developer.laminardata.aero/documentation/notamdata/v2)
- [Laminar platform overview](https://developer.cirium.com/apis/laminar-data-hub/overview)

The current reference explicitly says **“The NOTAM Data APIs currently require a contract to use.”** It documents global coverage and 60-second response caching. Country access can be agreement-specific. A platform free-trial advertisement does not override the NOTAM contract requirement or authorize public redistribution.

Documented contract (not exercised with credentials):

```text
Base: https://api.laminardata.aero/v2
GET /aerodromes/{aerodrome.icao}/notams
GET /icao-prefixes/{icao.prefix}/firs/{fir.icao}/notams
GET /tfrs
GET /notams
POST /notams  (GeoJSON spatial request)
Authentication: required query parameter user_key
Accept: application/json
```

The aerodrome path accepts four letters, case-insensitive. `GET /notams` requires a Q-code or text filter. The aerodrome/FIR documentation also describes conditional Q-code/text requirements despite describing retrieval of “all” aerodrome/FIR notices: **resolve unfiltered-query behavior with Cirium rather than filtering away safety-relevant notices just to make a request succeed**. Airport-only results are not route/FIR briefing completeness.

Success is a GeoJSON `FeatureCollection` with `features` and a `results` object (`publishTime`, `status`, `total`; the example renders `total` as a string). Features have an `id`, `geometry`, and `properties`, including:

- `number`, `year`, optional `series`, `location`, `publisherNOF`;
- optional `text`, `translations[].simpleText`, `issued`, `effectiveStart`, `effectiveEnd`;
- `effectiveEndInterpretation` (`EST`, `PERM`), `schedule`/`schedules`, `type` (`N`, `R`, `C`), and cancellation/replacement references;
- optional affected aerodrome/FIR, Q-code, vertical limits, and geometry provenance.

The detailed docs state that `EST`/`PERM` notices should be regarded as in force until specifically cancelled. Geometry can be absent or inferred; do not imply an inferred polygon is an authoritative surveyed boundary. Do not render provider HTML without sanitization; prefer plain text.

**Human gate:** use the reference's [Contact Us / Talk to Us](https://www.cirium.com/products/developer-studio/#talk-to-us) or [Cirium Help Desk](https://helpdesk.cirium.com/) to request a NOTAM contract and production key for this exact app. Agree display/redistribution, countries, aviation use, attribution, cache/offline retention, deletion obligations, quotas, and support before implementation. Keep `user_key` server-side and redact query strings from logs. No price or reuse entitlement was inferred.

### 4. Autorouter — documented API, permission needed

Sources read:

- [API overview](https://www.autorouter.aero/wiki/api/)
- [NOTAM endpoint and schema](https://www.autorouter.aero/wiki/api/notams/)
- [Authentication and application registration](https://autorouter.aero/wiki/api/authentication/)

Autorouter documents Eurocontrol EAD-originated notices and explicitly makes documented APIs available to third-party applications. It also warns against deriving undocumented APIs from frontend traffic.

```text
GET https://api.autorouter.aero/v1.0/notam
  ?itemas=["EDDS"]&offset=0&limit=100
POST https://api.autorouter.aero/v1.0/oauth2/token
Authorization on data calls: Bearer <issued token>
```

`itemas` is a JSON array that must be URL-encoded. `limit` is at most 100; follow `offset` until all `total` results have been received. Optional `startvalidity`/`endvalidity` filters are Unix seconds. Response: `{ total, rows: [...] }`; each row includes `id`, `itema`, `iteme`, `startvalidity`, `endvalidity`, `estimation`, `type`, `series`, `number`, `year`, `modified`, references, and Q-line data. `iteme` alone is not the complete original NOTAM. Coordinates in the documented response are Garmin integer encoding, not degrees.

Authentication docs require the account to be enabled for API use through a **support ticket before API work starts**. They document direct-account client credentials and registered third-party authorization-code flow. For a multi-user app prefer provider-approved delegated authorization rather than collecting users' passwords. The docs direct application registration to [autorouter support](https://autorouter.aero/support).

**Reuse blocker:** the reviewed official API pages do not establish permission to republish account-fetched NOTAMs to all anonymous visitors or commercially redistribute them. Obtain explicit approval covering this access pattern and EAD-derived rights. A third-party claim of anonymous access or personal reuse is not authorization; no unauthenticated data probe was used to bypass the documented permission gate.

## Exact owner actions to unblock the minimal integration

1. Email **NOTAMS@faa.gov** with subject `NMS distribution API access — aviationweather.vercel.app`. Identify the operator/legal entity and contact; explain the public pilot-facing airport/weather/planning app, intended countries, commercial or noncommercial model, expected traffic, and whether operational use is intended. Do not describe operational use as research to obtain easier access.
2. Request the **current production NMS distribution** API agreement and OpenAPI/schema; approved auth method and credential issuance; ICAO/local-identifier mapping; airport/FIR/route coverage; original text, time/schedule and lifecycle fields; pagination, totals, updates/deletions and snapshot reconciliation; rate limits and acceptable cache interval.
3. Ask specifically whether public anonymous display, commercial reuse, server caching, browser/PWA offline retention, and derived categories are permitted; request required attribution, warnings and geography restrictions. Confirm which legacy interfaces are retiring and the production migration timetable.
4. If FAA cannot support this use, ask Cirium for the same scope in a NOTAM contract. Autorouter is viable only after support approves the actual application/access model and redistribution rights. Do not create accounts or commit to spend without the owner's approval.
5. After approval, supply secrets through the deployment secret manager—not chat, client bundles, `NEXT_PUBLIC_*` variables, screenshots, or source control. Configure only the actual documented auth fields; this research deliberately does not prescribe invented FAA credential variable names.
6. Implement one server-side provider adapter behind `/api/notam/[icao]`, retaining the current failure envelope. Use strict identifier validation, bounded fetch timeouts, auth-error handling, quota-aware caching, complete pagination and runtime schema checks. Preserve raw plain-text notices and provider identifiers/timestamps; add provenance and coverage limitations. Handle cancellations, replacements, schedules and `EST`/`PERM` explicitly; if interpretation is unknown, display uncertainty rather than a definitive active/inactive decision.
7. Verify against authorized live samples and provider documentation: nonempty and genuinely empty results, multiple pages/totals, missing fields, local identifiers, permanent/estimated/scheduled notices, cancellation/replacement, unsupported geography, auth failure, timeout and rate limiting. Confirm old cached data is labelled stale and never silently renewed. Review the actual deployed UI after authorized rollout. Tests/AI review do not make a flight briefing complete or certify safety.

## FAA weight-and-balance / wind-triangle references

Official material opened directly (PDF text was fetched and extracted, not inferred from search snippets):

- [FAA Weight & Balance Handbook, FAA-H-8083-1B](https://www.faa.gov/sites/faa.gov/files/2023-09/Weight_Balance_Handbook.pdf). The preface says aircraft-manufacturer information takes precedence in conflicts. Its method sums weights and moments and divides total moment by total weight; aircraft-specific limits and records remain essential.
- [Pilot's Handbook of Aeronautical Knowledge, FAA-H-8083-25C, official chapter index](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak).
- [PHAK Chapter 10: Weight and Balance](https://www.faa.gov/sites/faa.gov/files/12_phak_ch10.pdf), especially Figure 10-5 and the computational method. It explicitly requires the particular aircraft's weight-and-balance records; CG limits can vary with gross weight and configuration. Its worked example reports 3,320 lb, moment 281,430, CG 84.8 inches. These are source example values, not this application's validated outputs.
- [PHAK Chapter 16: Navigation](https://www.faa.gov/sites/faa.gov/files/18_phak_ch16.pdf), “Wind Triangle or Vector Analysis,” printed pp. 16-13–16-16 and Figures 16-20–16-23. It distinguishes true course, true heading, groundspeed, wind correction, magnetic variation and compass deviation; the illustrated solution reports true heading 076° and groundspeed 88 knots. These are rounded graphical reference values, not an app test result.

### Independent validation still outstanding

Official references support test design; they do not independently validate this software or any aircraft profile. No W&B or wind-triangle calculations were executed or aviation sign-off obtained in this research task.

Before claiming aviation validation:

- Have a qualified human aviation reviewer (for example a CFI for navigation/planning, plus appropriately qualified aircraft W&B expertise) check the **actual aircraft's** current approved POH/AFM, equipment/empty-weight records, datum, arms, usable/unusable fuel, units, loading limits and CG envelope. A generic handbook or model template cannot establish tail-specific accuracy.
- Build expected outputs independently of the app's implementation: reproduce cited FAA worked examples and aircraft-approved examples using hand calculations, a trusted independent calculation method, and/or a physical E6B. Record source edition/page, inputs, units, rounding tolerance, expected output, app result, reviewer identity/qualifications, date and discrepancies.
- Cover W&B boundary and invalid cases, unit conversions, moment-index scaling, gross-weight-dependent envelopes, fuel burn/landing CG and configuration changes. For wind triangles cover calm/head/tail/crosswinds, wind-*from* convention, true versus magnetic references, quadrant/360° wrap, infeasible crosswind solutions and nonpositive groundspeed; compare results at declared tolerances, not exact equality to graphical rounding.
- Separate algorithm agreement, aircraft-data provenance, UX interpretation and operational suitability. A second model, AI-generated fixtures, code review, automated tests or AI consensus are **not independent aviation validation**, certification, regulatory approval, or a substitute for pilot preflight responsibilities.

## Research limitations

No provider credentials or contractual authorization were available/used. Public source statements were read directly; private FAA schemas and final reuse agreements remain unavailable. A PDF extraction service timed out, then direct FAA PDF retrieval plus `pdftotext` succeeded. Cirium's browser-generated OpenAPI download failed; its public rendered reference and embedded server declaration were read instead. No protected NOTAM UI internals were scraped. This document makes no claim that a replacement integration is implemented, production-tested, authorized, or operationally complete.
