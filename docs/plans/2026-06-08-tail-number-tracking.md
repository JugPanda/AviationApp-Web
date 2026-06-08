# Tail Number Tracking Upgrade Plan

## Goal
Add live aircraft lookup by tail number without making the existing callsign/hex workflow worse.

## Scope
1. Replace the current OpenSky-only search path with a source that exposes aircraft registration data.
2. Normalize flight-search input so users can search by tail number, callsign, or ICAO hex.
3. Add lightweight hints so users understand accepted formats and common tail-number pitfalls.
4. Preserve map tracking behavior and add regression coverage for matching/normalization.

## Implementation notes
- Use adsb.lol endpoints because they expose `registration`, `callsign`, and `hex` lookups directly.
- Keep the default map-wide flight layer by querying nearby aircraft around the US centroid.
- Convert API units into the app's existing `FlightData` contract so current UI stays stable.
- Prefer explicit no-match guidance over ambiguous silent failures.

## Verification
- `npm test`
- `npm run build`
- Spot-check the new flight API route with registration, callsign, and hex queries.
