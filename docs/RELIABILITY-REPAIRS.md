# Reliability repairs

This release addresses the follow-up audit of commit `1446e67`. It is not aviation certification or independent validation of aircraft templates. Existing navy/ivory/orange responsive presentation and provider permissions remain unchanged.

## Weather contracts and freshness
- A missing/failing NOTAM provider returns an explicit unavailable notice, not a successful empty list. A supported NOTAM integration is still required for actual coverage; no replacement provider or permission was invented.
- Upstream HTTP 204 is valid empty data for METAR, TAF, PIREP, SIGMET and NOTAM routes.
- SIGMET parsing normalizes provider epoch seconds and documented/observed coordinate shapes, separate areas and dateline-split rings. Invalid reports/areas are omitted with an incomplete-coverage warning; valid subsets remain drawable. Successful retrieval also discloses that these feeds do not supply G-AIRMETs or Alaska AIRMETs.
- Airport metadata, forecasts and NOTAMs have separate retrieval timestamps. Metadata can no longer renew forecast age. Legacy weather cache data survives but its old shared timestamp does not prove forecast freshness.
- Stale/expired/unknown forecasts revalidate on selection. Failed retrieval retains the previous forecast and timestamp with a visible warning and manual retry. Valid-empty responses are distinguished from failure. Malformed validity windows cannot become fresh cached forecasts.
- Map notices have opaque, readable backgrounds. The SIGMET notice identifies coverage rather than calling every successful but limited feed unavailable.

## Calculations and validation
- Planner magnetic heading follows the displayed east-positive/west-negative convention: `MH = TH - variation`, normalized to a compass heading.
- Planner and standalone wind tool use a shared wind-triangle solution. Impossible crosswind and nonpositive groundspeed have no usable trip solution; headings and dependent totals are withheld with an explicit explanation instead of clamping to plausible-looking numbers.
- W&B checks finite/nonnegative loading, station maxima and fuel capacity. Invalid loading does not display a valid result.
- Custom-aircraft limits and envelope points are validated. Weight points are sorted consistently for calculations/charting; duplicate weights and invalid boundaries are rejected without discarding the draft.

## Local record integrity and compatibility
- Manage/Edit profile is explicitly rename-only: the saved aircraft/loading snapshot is not replaced by the currently displayed calculator configuration.
- Custom profile loading uses its embedded aircraft definition rather than a same-name library definition. Duplicate library names cannot silently replace an existing definition.
- W&B storage failures do not crash initialization. Failed saves preserve drafts; corrupt records are protected from mutation. Profile export preserves original raw bytes for recovery.
- Planner saves/deletes reject stale snapshots, preserve drafts, and offer explicit refresh. Web Locks serialize planner writes where available. Profile conflicts and browsers without Web Locks use optimistic checks, not an atomic database transaction.
- New plans use optional backward-compatible schema version 2 fields: date and magnetic variation. Older records remain unchanged; missing fields load as explicitly unset rather than invented values. Print uses the selected date.
- Existing storage keys are retained. No automatic destructive migration, account, cloud sync or database was added.

## Regression checks
Run `npm test`, `npm run build`, `npm run typecheck`, `npm run lint`, and `npm run test:browser` against a fresh production server. New suites:
- `tests/weather-api-reliability.test.ts`
- `tests/briefing-freshness.test.ts`
- `tests/planner-reliability.test.ts`
- `tests/weight-balance-reliability.test.ts`
- `tests/weather-reliability-ux.spec.ts`
- `tests/planner-reliability-ux.spec.ts`
- `tests/weight-balance-reliability-ux.spec.ts`

Fixtures explicitly model faults and provider contracts; they are not represented as live observations. Integrated browser checks include desktop/mobile, canvas-painted SIGMET polygons, expired forecast retry, preservation of original storage bytes, simultaneous planner writes, custom aircraft collisions, and invalid loading. Existing landing/logbook/offline/provider-gate checks remain included. Release-specific source SHA, deployment, canonical-provider observations and exact totals are recorded in the external verification report.

## Still outside this release
Physical Android/iPad/Safari certification, independent aircraft/math validation, actual supported NOTAM integration, additional AIRMET feeds, provider licensing, cloud/device sync, comprehensive plan backup tooling and mobile performance optimization. Browser-local storage still requires deliberate backups. Existing unrelated lint/cache-size warnings remain documented rather than hidden.
