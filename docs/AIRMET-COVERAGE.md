# Public AWC advisory coverage

## Scope and limits

The hazard layer retrieves documented public Aviation Weather Center (AWC) feeds. No paid provider, credentials, undocumented endpoint, or licensing bypass is involved. This display is supplemental situational awareness, not a certified briefing service or an all-clear. NOTAM support is unchanged and separate.

The product selector deliberately separates:

- **Current SIGMET**: existing polygons with explicit `validTimeFrom <= now < validTimeTo`.
- **Alaska AIRMET forecast zones**: provider zone outlines during their provider product period. These are **not precise hazard boundaries**. Local timing, altitude, and geographical qualifications require the official Alaska forecast; the compact GeoJSON does not contain all of them.
- **G-AIRMET snapshots**: CONUS forecast polygons at the exact provider `validTime`. They are not current-condition polygons and not continuously valid until the next snapshot. Only the selected time is drawn; SIGMET and Alaska polygons are hidden in this view.

All displayed times are UTC. The default is current SIGMETs, not forecasts. The selector includes the actual snapshot times returned by AWC's default query, not an invented time ladder. This implementation does not request the complete 0/3/6/9/12-hour forecast package or provide interpolation. Expired packages are removed from snapshot choices; an expired selection returns to current SIGMETs, not silently to another forecast. A 30-second display clock rechecks expiration between network refreshes.

## Contract and compatibility

`/api/sigmet` keeps `{ items, status, updatedAt, message? }` and the existing `all|sigmet|airmet` query values. Legacy source selection is preserved: `sigmet` selects `isigmet`, `airmet` still includes `airsigmet`; `all` includes both. `all` and `airmet` now additionally fetch:

- `https://aviationweather.gov/api/data/gairmet?format=json`
- `https://aviationweather.gov/api/data/airmet?format=geojson`

`airsigmet` is still a SIGMET feed despite its legacy name; it is not used as evidence of AIRMET coverage. Requests use a custom user agent, a 15-second upstream timeout, and existing 300-second Next fetch revalidation. The client refresh remains ten minutes. No client-side requests are made to AWC.

A G-AIRMET item adds `product: 'G-AIRMET'`, `timeKind: 'snapshot'`, `snapshotTime`, `issuedAt`, and `productExpiresAt`. For old range consumers, `validFrom` and `validTo` both equal the snapshot instant and `isActive` is false. **Package issue/expiry never becomes an invented hazard validity interval.** The current client requires these fields together and validates them before rendering. Alaska items use `product: 'Alaska AIRMET'`, `timeKind: 'period'`, and `zone`; their legacy interval/isActive refers only to the provider product period.

HTTP 204 is handled before JSON parsing. Alaska empty GeoJSON FeatureCollections are successful no-data. Malformed bodies, failed feeds, unsupported geometries, and malformed reports produce HTTP 503 / `status: 'unavailable'` **with the valid sibling items retained**. Messages identify affected feeds. The client renders the valid subset in the selected view alongside the incomplete-coverage notice. An empty view explicitly is not an all-clear.

## Observed provider details and conservative exclusions

### G-AIRMET

The live JSON sample contains decimal **strings** for `coords[].lat/lon`, despite numeric schema examples. Only this adapter accepts strict decimal strings; the SIGMET validator is not weakened. A complete invalid ring is rejected rather than dropping vertices.

Live freezing-level records can say `geometryType: AREA` while `geom: LINE`. `geom` takes precedence. Lines are not rendered as filled polygons or buffered into invented areas. Unsupported lines therefore leave coverage incomplete; ordinary polygon siblings remain usable. Multiple-freezing-level AREA records can still render.

Three-digit base/top/freezing-level encodings are hundreds of feet, corroborated against the XML `min_ft_msl`/`max_ft_msl` fields. For example JSON ICE tag 2C `top: '200'`, `fzlbase: '070'`, `fzltop: '110'` corresponds to XML 20000/07000/11000 feet MSL. `SFC` stays “surface,” not zero MSL; `FZL` stays “freezing level,” not an invented numeric base. Unknown or reversed numeric encodings are rejected. Missing bounds remain “not specified.”

### Alaska

JSON has no coordinates; GeoJSON supplies named forecast-zone polygons. The observed high-level region boundaries repeat across hazards and cannot encode qualifications such as “N MT SHISHALDIN–PAJC LN” or “AFT 12Z.” They are labeled as zone/product data, never exact hazard extents or exact local occurrence times.

**Altitude normalization is blocked by conflicting provider representations.** The observed Alaska Peninsula TURB item has `base: 300, top: 400`. The corresponding IWXXM TAC comment says `FL300-FL400`, but the generated IWXXM geometry labels `300` and `400` as `uom="FT"`; its bulletin is also marked `NON-OPERATIONAL` / `TEST`. This implementation does not choose one interpretation or multiply silently. Numeric altitude fields are omitted; an explicit “units unverified” notice and unchanged provider metadata remain available in the popup. IWXXM is research evidence only, not a runtime feed.

Polygon holes are not supported by the existing flat-ring contract and are not silently filled. MultiPolygon members are handled independently, retaining valid siblings. Out-of-range Alaska coordinates (including an observed western Aleutian `-190.7` longitude) are omitted with incomplete coverage, not broadly wrapped into a potentially world-spanning polygon. This is intentionally partial Alaska coverage until a separately verified dateline-splitting renderer exists.

## Sources and bounded samples

Read on 2026-11-22 before implementation:

- API documentation: <https://aviationweather.gov/data/api/>
- Current OpenAPI: <https://aviationweather.gov/data/schema/openapi.yaml> (`GairmetJSON`, `AirmetJSON`, `AirmetGeoJSON` and endpoint parameters).
- Product semantics: <https://aviationweather.gov/help/data/#gairmet>
- G-AIRMET JSON: <https://aviationweather.gov/api/data/gairmet?format=json> — HTTP 200, 41 records in the bounded sample; nearest returned snapshot was 2026-11-22 06:00 UTC, package expiration 09:00 UTC.
- Alaska JSON: <https://aviationweather.gov/api/data/airmet?format=json> — HTTP 200, 60 records, no geometry.
- Alaska GeoJSON: <https://aviationweather.gov/api/data/airmet?format=geojson> — HTTP 200, 60 features with zone geometry.
- G-AIRMET XML altitude cross-check: <https://aviationweather.gov/api/data/gairmet?format=xml&hazard=ice> — HTTP 200, four ICE records.
- Alaska altitude/timing cross-check: <https://aviationweather.gov/api/data/airmet?format=iwxxm&hazard=turb> — HTTP 200; bounded prefix inspected, not claimed as a complete bulletin capture.

These are dated sample observations, not guarantees of current counts. Test fixtures preserve the complete observed IFR tag 1E ring and Alaska Peninsula TURB zone ring. Mutated/combined fixtures are explicitly test scenarios, not claimed live reports.

## Verification and integration gate

Targeted Vitest coverage includes raw-provider shapes, snapshot versus product dates, decimal coordinates, altitude symbols, unsupported lines/holes/dateline values, valid siblings on partial failure, empty FeatureCollections versus malformed bodies, and client product selection/expiration. Existing SIGMET regression tests remain in scope.

An in-memory TypeScript adapter probe against a second bounded live retrieval returned 29 normalized G-AIRMET polygons from 41 records (12 FZLVL LINE records omitted), and 58 normalized Alaska zones from 60 records (two western Aleutian region AK polygons omitted). All retained items passed the client rendering validator. These are adapter results, not proof of Leaflet paint or completeness.

`tests/weather-reliability-ux.spec.ts` extends the 360px/1440px hazard test with mutually exclusive product selection, visible partial warnings, actual purple G-AIRMET canvas pixels, and screenshots. Browser execution, visual review, production build, and deployment belong to the integrating parent; unit fixtures are not a claim of live/browser verification.
