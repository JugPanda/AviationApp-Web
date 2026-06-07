# AviationApp Trustworthiness + Accessibility Upgrade Plan

> **For Hermes:** Implement this plan directly in the current repo with small, verifiable changes.

> **For implementer:** Jug wants AviationApp to keep maturing as a serious pilot utility, not just a demo map. Prioritize data trustworthiness, clear degraded-state handling, and mobile/accessibility polish over feature sprawl.

**Goal:** Improve operational trust by removing fabricated live hazard data, surfacing degraded overlay states clearly, and tightening accessibility on the main map workflow.

**Architecture:** Keep the existing feature set, but standardize hazard overlay API responses so the UI can distinguish live/unavailable states. Add a lightweight map notice overlay for degraded data and make the highest-traffic controls/sheets more accessible without restructuring the whole app.

**Tech Stack:** Next.js app router, React, TypeScript, React Leaflet, Vitest.

---

## Scope for this implementation pass

1. **Hazard overlay trustworthiness**
   - Remove production sample/demo fallbacks from TFR/PIREP/SIGMET APIs.
   - Return structured response envelopes with `items`, `status`, `message`, `updatedAt`.

2. **User-visible degraded-state messaging**
   - Update overlay components to consume the new envelope.
   - Show clear map notices when a layer is unavailable instead of silently rendering fake data or failing quietly.

3. **Main-workflow accessibility pass**
   - Add accessible names to icon-only buttons and close controls.
   - Add dialog semantics to mobile sheets and side panels used as dialogs.
   - Improve search input semantics.

4. **Verification**
   - Add route-level tests for new overlay fallback behavior.
   - Re-run tests and production build.

---

## Task 1: Add shared overlay response typing

**Objective:** Standardize the API/UI contract for hazard overlays.

**Files:**
- Create: `src/lib/overlay-response.ts`

**Implementation notes:**
- Export a generic type similar to:
  - `OverlayResponseStatus = 'live' | 'unavailable'`
  - `OverlayResponse<T>` with `items`, `status`, `message?`, `updatedAt`
- Export small helpers:
  - `buildLiveOverlayResponse(items)`
  - `buildUnavailableOverlayResponse(message)`
  - `isOverlayResponse(value)` guard

**Verification:**
- Type-check via `npm run build`

---

## Task 2: Remove fabricated fallback data from TFR/PIREP/SIGMET APIs

**Objective:** Ensure safety-related overlays never present sample data as live.

**Files:**
- Modify: `src/app/api/tfr/route.ts`
- Modify: `src/app/api/pirep/route.ts`
- Modify: `src/app/api/sigmet/route.ts`
- Import from: `src/lib/overlay-response.ts`

**Implementation notes:**
- Replace `getSample*()` return paths with structured unavailable responses.
- Keep successful live payloads, but wrap them in `{ items, status: 'live', updatedAt }`.
- On upstream failure or empty/unusable live data:
  - return `503`
  - `items: []`
  - `status: 'unavailable'`
  - clear message telling user to cross-check official briefing sources
- Remove now-unused sample data helpers.

**Verification:**
- Add tests first in Task 5.
- Run targeted tests for route behavior.

---

## Task 3: Teach overlay layers to handle degraded status and show notices

**Objective:** Make overlay failures visible to the user instead of silent or misleading.

**Files:**
- Create: `src/components/MapLayerNotice.tsx`
- Modify: `src/components/TFRLayer.tsx`
- Modify: `src/components/PirepLayer.tsx`
- Modify: `src/components/SigmetLayer.tsx`
- Import from: `src/lib/overlay-response.ts`

**Implementation notes:**
- Add a small portal-based map notice component that anchors inside the map container.
- Each layer should:
  - parse envelope responses
  - set items from `data.items`
  - set a layer-specific notice when `status === 'unavailable'`
  - stop treating non-200 as an automatic generic throw before reading JSON
- Use non-overlapping notice positions where practical.
- Keep existing map rendering for live items only.

**Verification:**
- Manual dev check via local app/curl
- `npm run build`

---

## Task 4: Accessibility pass on core controls and dialog surfaces

**Objective:** Improve the main map workflow for screen readers and better semantics.

**Files:**
- Modify: `src/components/SearchBar.tsx`
- Modify: `src/components/AirportInfo.tsx`
- Modify: `src/components/FlightInfo.tsx`
- Modify: `src/app/page.tsx`

**Implementation notes:**
- Add a semantic label for airport search.
- Add `aria-label` / `title` to icon-only buttons:
  - search submit on mobile
  - refresh button
  - close buttons
- Add `role="dialog"`, `aria-modal="true"`, and `aria-label`/`aria-labelledby` to:
  - mobile quick actions sheet
  - layers sheet
  - filters sheet
  - airport info sheet
  - flight info sheet
- Make flight close button visible and accessible on mobile too.

**Verification:**
- Code inspection
- `npm run build`

---

## Task 5: Add regression tests for overlay API degraded-state behavior

**Objective:** Lock in the new trustworthiness behavior.

**Files:**
- Create: `tests/overlay-routes.test.ts`

**Implementation notes:**
- Mock `global.fetch`.
- Verify:
  - TFR route returns `503` + empty items when upstream fails.
  - PIREP route returns `503` + empty items when upstream is non-OK.
  - SIGMET route returns `503` + empty items when all upstream requests fail.
- Assert that sample/demo identifiers are not present.

**Verification:**
- `npm test`

---

## Task 6: Final verification

**Objective:** Confirm repo health after the upgrade pass.

**Files:**
- No code changes expected

**Run:**
- `npm test`
- `npm run build`
- Optional targeted curls:
  - `/api/tfr`
  - `/api/pirep`
  - `/api/sigmet`

**Expected:**
- Tests pass
- Production build passes
- Overlay APIs return structured live/unavailable envelopes
- Main map controls and sheets have improved semantics

---

## Follow-up backlog (not in this implementation pass)

1. TTL-aware cache freshness for briefings/TAF/NOTAM/localStorage
2. Service-worker API cache policy hardening
3. Mobile NavLog form relabeling/restructure
4. Home page decomposition from `src/app/page.tsx`
5. Route-per-tool lazy loading for `/tools`
