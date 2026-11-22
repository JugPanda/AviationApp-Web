# Backup, hazard coverage and runtime follow-up

## Delivered scope

- Planning: versioned JSON exports and legacy-array imports; preview/cancel, new plan/waypoint IDs, preserved editor and original records, bounded all-or-nothing validation, raw recovery downloads. Unsafe integer metadata is rejected instead of silently rounded during import.
- Cooperating planner tabs: Web Locks plus transactional IndexedDB fingerprints reject stale localStorage caches. Plan contents remain at the existing localStorage key. Denied coordination fails closed. Aborted live transactions attempt exact-byte restoration.
- Export validates its snapshot against the fingerprint. Mismatched/unverifiable snapshots are explicitly incomplete raw recovery files, not complete backups.
- Interrupted-process or older-version writes can leave a fingerprint mismatch. Backup-first recovery requires reviewed copies and explicit acknowledgement that other app tabs are closed. It compares both the exported fingerprint and raw snapshot before updating only the fingerprint, never records. It is not an automatic merge and cannot restore missing records. Old/noncooperating tabs are outside the transactional protocol.
- Public AWC G-AIRMET snapshots and Alaska AIRMET forecast-zone views are separate from current SIGMETs. UTC selectors and incomplete-coverage notices preserve product limitations; see AIRMET-COVERAGE.md.
- Map warnings share a bounded, scrollable disclosure stack, leaving status visible at mobile and desktop widths.
- Airport CSVs use header names, coalesced loading and atomic process-local snapshots rather than oversized Next Data Cache entries. Failed refreshes do not renew expired data.
- Secondary tools load on selection; unrelated shell navigation does not prefetch. Walkthrough media has no source until explicitly loaded, with captions and fallback download.
- Timer dependency repair and dead-code lint cleanup.

## Local release acceptance, 2026-11-22

- `npm test`: 284 passing tests across 19 files.
- `npm run typecheck`, `npm run lint -- --max-warnings=0`, `npm run build`, `git diff --check`: passed.
- `npm audit`: zero vulnerabilities at verification time.
- Production-runtime Playwright: 136/136 Chromium and 136/136 WebKit, no skipped or flaky tests in the final full runs. Includes widths 360/390/768/1440 where applicable, focus, axe checks, storage failures, simultaneous writes, recovery CAS conflicts and hazard canvas rendering.
- WebKit dialog fixture repeated 10/10 after removing an unnecessary immediate second navigation that interrupted initial service-worker registration. Real service workers and strict page-error assertions remain enabled.
- Prior abort-test timeout was a harness error: retry attempted to click an intentionally disabled control without explicit Refresh. Original bytes were already restored. Final tests verify disabled state, Refresh, then successful retry.
- Real local KJFK/KLAX airport responses: HTTP 200; fresh runtime had no oversized Data Cache warnings. Hazard probe returned valid SIGMET/G-AIRMET/Alaska subsets plus explicit incomplete coverage; NOTAM returned unavailable, not a false all-clear.
- Mobile Lighthouse `/tools`: baseline 92 performance / 100 accessibility / 100 best practices; final artifact 92 / 100 / 100. Total transfer decreased from 302,896 to 265,372 bytes. Earlier 95 performance score was a variable lab result, not a guaranteed improvement.

## Explicit boundaries

No provider account, paid contract, NOTAM credentials, or redistribution permission was activated. See NOTAM-INTEGRATION.md. No cloud sync, guaranteed backup, dependable offline flight service, physical Android/iPad certification, independent aviation validation, or new aircraft-specific data is implied. C182T is not T182T; C172S is not 172N. This remains a supplemental-use preview.

Local acceptance does not establish deployment. Exact remote commit, canonical deployment and live test evidence belong in the release handoff.
