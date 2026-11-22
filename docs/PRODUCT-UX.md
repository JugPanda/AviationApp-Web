# Product UX: research and implementation

## Goal and scope
Improve the weather, manual planner, pilot tools and local logbook on **desktop, tablet and mobile**, preserving the approved navy/ivory/orange identity. This is comprehension-oriented design, not manipulative social engineering and not an aviation certification exercise.

## Research → design choices

1. **Recognition over recall and visible system state.** [Nielsen Norman Group: Ten Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/). Use descriptive navigation, persistent selected-tool titles, units next to inputs, retained airport search text and specific save/error feedback. These are usability heuristics, not guaranteed measured improvements.
2. **Progressive disclosure.** [NN/G: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/). Move weather layers, detailed geographic filters and secondary logbook fields behind named controls. Keep observation timestamps, source limitations, illustrative aircraft warnings and local-only storage visible. All ten tools remain available on both layouts.
3. **Perceptual grouping.** [NN/G: Proximity Principle](https://www.nngroup.com/articles/gestalt-proximity/). Give related labels/inputs/results a clear container and separate route, aircraft assumptions, legs and review. Desktop layouts use available width; mobile stacks groups with readable spacing instead of shrinking controls.
4. **Accessible targets, labels and reflow.** [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [Understanding Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Primary controls target 48 CSS pixels, exceeding the 24px AA minimum where applicable; associate fields with labels, preserve visible focus, test keyboard dialogs, and keep wide data tables in their own scrolling region. This does not claim full WCAG conformance from automated tests alone.
5. **Attention and warning fatigue.** [FAA AC 25.1322-1, Flightcrew Alerting](https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_25.1322-1.pdf). Avoid turning every routine status into an alarm, and distinguish operational limitations from ordinary state. This advisory concerns transport-airplane alerting; its prioritization principle is informative here, not certification authority for this app.
6. **User needs and context.** [GOV.UK Government Design Principles](https://www.gov.uk/guidance/government-design-principles). Organize around tasks, test actual workflows across viewport sizes, and favor predictable patterns over decorative novelty.
7. **Transparency instead of deception.** [FTC report on dark patterns](https://www.ftc.gov/news-events/news/press-releases/2022/09/ftc-report-shows-rise-sophisticated-dark-patterns-designed-trick-trap-consumers). No fabricated social proof, urgency, endorsements, hidden storage limitations or misleading safety approval. Recency summaries are incomplete counters, not legal currency clearance.

Sources retrieved during the design research on 2026-11-22. Research supports the design direction; no user study or conversion experiment was conducted.

## Delivered interface
- **Shared:** larger reading sizes and controls, consistent section spacing, explicit Weather / Planning / Tools / Logbook navigation and active states. Existing preview notice and home navigation retained.
- **Weather:** visible page purpose and labeled search; weather layers/filters/overview on all sizes; full state names and category descriptions; explicit retrieval-vs-observation wording. A wider airport drawer, readable six-section navigation, persistent UTC observation timestamp and mobile expand/reduce control. Recent saved reports are opened without resetting their map-level cache age.
- **Planner:** numbered Route / Aircraft assumptions / Waypoints & legs / Review groups, input units, helpful empty results and visible excluded-leg counts. Desktop columns, mobile cards, contained print-preview table and keyboard-operable save/load dialogs. Existing data schema and formulas retained; previously unsaved date/variation behavior explicitly disclosed rather than silently promised.
- **Tools:** descriptive grouped desktop directory, native mobile selector, selected-tool explanation, readable input/result sections, associated labels and no fixed mobile quickbar obscuring results. All ten calculators/utilities, W&B warnings and saved profiles retained.
- **Logbook:** clear empty state, entries/totals/recency navigation, grouped entry form, secondary-field disclosure, distinct backup/import/delete actions. Failed writes preserve drafts and original data; malformed records remain downloadable for recovery; stale tabs cannot overwrite newer records. No schema migration, cloud sync or auth added.

## Verification strategy
- Characterization/unit checks for computation, hydration, provider gates and stored schema/keys.
- Browser scenarios at 360/390, 768 and 1440 widths: real airport search, UTC timestamp, filters/layers, native dialog keyboard loops and Escape, all ten tools, W&B profile persistence, actual manually entered planner computations, logbook create/edit/cancel/delete/import/export, malformed data and storage-failure recovery.
- Failures use explicit isolated transport/storage fixtures. These are not represented as real provider results. The airport success tests use actual provider-backed retrieval.
- Original landing/media/provider/offline/service-worker regressions remain included. Predecessor-worker migration tests use a test-only local origin, not a real user's browser.
- Final live release identity and numerical results are recorded in the external verification report, rather than claiming a deployment before it occurs.

## Boundaries
The app remains supplemental. Aircraft templates/calculations and legal recency interpretations are not independently validated. Records remain browser-local. Current map retrieval, provider errors, permissions and freshness require attention. Physical Samsung/iPad/Safari operation is not established by Chromium viewport emulation. The landing's explicitly historical screenshots/recording are retained as historical captures, not misrepresented as a new recording of this redesign.
