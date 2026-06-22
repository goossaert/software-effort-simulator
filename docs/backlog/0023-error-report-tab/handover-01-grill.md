---
schema: backlog-handover/v1
task_id: "0023"
produced_by_phase: grill
feature_phase: null
for_next_phase: apply-docs
outcome: success
reason: ""
produced_at: 2026-06-22T18:49:16Z
produced_commit: a8bc907f75a82435f64b1df53a392da3f6b1d1b5
---
## Summary

Grill birthed task 0023: a new advisory **Error Report** results tab that surfaces
data-quality problems the simulator currently handles silently. The author and
grill settled four foundational decisions: (1) findings are collected by
**instrumenting the actual Run path** (single source of truth — the report can
never disagree with what the sim computed), not by an independent re-analysis;
(2) the report is **advisory only** — it never aborts or alters a Run, and the two
existing hard stops stay unchanged; (3) the known multi-quarter forward
double-count is **reported at ERROR but the engine math is NOT changed** here; and
(4) when a Run hard-throws (the all-sizes-unmapped fatal case) the report does not
render — it covers **completed Runs / non-fatal issues** only. The acceptance
criteria were linted (two findings, both resolved below). apply-docs must apply the
CONTEXT.md glossary additions and create ADR-0037, then advance to plan.

## Instructions for the next phase (apply-docs)

1. Apply the **## CONTEXT.md edits to apply** verbatim into the repo-root
   `CONTEXT.md`, matching the surrounding glossary house style (bold term + em-dash
   + definition, with cross-referenced glossary terms in bold). Place each entry in
   sensible alphabetical/logical position among the existing entries.
2. Create the ADR in **## ADRs to create** at `docs/adr/0037-error-report-advisory-diagnostics.md`
   with the full text given.
3. The mechanical toolchain is already selected (`toolchain.selected: true`) — see
   **## Mechanical toolchain to apply**; do nothing there beyond recording the
   no-op (`toolchain_applied: "already-selected"`).
4. Advance the task to `stage: plan`, write `handover-02-apply-docs.md`, and hand
   the plan phase the **## Plan logistics** below (lint-cleared AC-* / I-* / DC-*).

## CONTEXT.md edits to apply

Add the following glossary entries to repo-root `CONTEXT.md` (house style: bold
term, em-dash, definition; bold cross-references). These define every new term the
acceptance criteria use, so they MUST land before plan.

> **Error Report** — A results tab (slug `error-report`, last in the tab bar) that
> lists **data-quality findings** detected during a **Run**. Advisory only: it never
> aborts or changes a **Run**; it reports what the simulator silently excluded or
> coerced. Present only for Runs that complete — a fatal Run keeps its existing
> error message. See ADR-0037.

> **Data-quality finding** — A single issue surfaced in the **Error Report**: a
> stable `code`, a **severity** (`ERROR`, `WARNING`, or `INFO`), the offending
> identifier(s) (an **Epic** key, **Initiative** key, **Quarter** label, or row),
> and a quantified impact where possible. Findings are recomputed each **Run** and
> never persisted.

> **Severity** — The triage level of a **data-quality finding**: `ERROR` (distorts
> the forecast — e.g. an in-scope item silently dropped, or a multi-quarter forward
> double-count), `WARNING` (likely-wrong or partially-excluded data), or `INFO`
> (structural note, not wrong).

> **Recognised t-shirt size** — One of the seven canonical **T-shirt size** labels
> (`2XS`, `XS`, `S`, `M`, `L`, `XL`, `XL+`) after normalisation (`trim()` +
> upper-case). A size that is not recognised maps to 0 PM and is excluded from
> **Poisson λ** and the **Bootstrap pool**.

> **In-scope epic / Out-of-scope epic** — An **Epic** is *in-scope* for **Poisson
> λ** calibration when its **Quarter** tag is in the selected **Historical quarter**
> window, or (when it has no quarter tag) when its parent **Initiative** is in scope.
> An epic that is neither — and an **orphan epic** (empty parent) — is *out-of-scope*
> and silently excluded from λ and the **Bootstrap pool**.

## ADRs to create

### `docs/adr/0037-error-report-advisory-diagnostics.md`

```markdown
# 37. Error Report tab — advisory, post-Run data-quality diagnostics collected in the Run path

Date: 2026-06-22

## Status

Accepted

## Context

The simulator silently drops or coerces several classes of bad or missing input,
and the operator cannot see any of it from the CSVs alone:

- An unrecognised / typo t-shirt size maps to 0 PM (`tshirtToPersonMonths`,
  index.html:1341-1345) and is excluded from both Poisson λ and the bootstrap pool
  (the `T_SHIRT_PARAMS[size]` guards, ~index.html:2087-2104); for constant work it
  silently contributes 0 PM.
- An epic with neither an in-scope quarter tag nor an in-scope initiative link is
  excluded from λ (the `!inScope || !link` site, ~index.html:2084); an orphan epic
  (empty parent) is unhandled.
- A selected historical quarter with initiatives but no loaded epics has its
  initiatives excluded from the λ denominator (the `quartersWithEpicData` filter,
  ~index.html:2061-2073).
- Duplicate initiative keys and quarter-label variants are unhandled and distort
  counts.
- λ = 0 and total K = 0 only `console.warn` (~index.html:4566, ~4570); capacity and
  iterations are silently coerced/clamped (~index.html:4540-4542); constant-work
  rows whose category matches no Group are silently excluded.
- An initiative spanning N target quarters is counted ~N× because target K counts
  per-row/quarter (`bucketRowsByGroups` ~index.html:2005; ~index.html:2108) while
  historical λ counts per unique initiative key (~index.html:2081-2089).

These distortions silently bias the forecast. We need to surface them without
changing the simulation's behaviour.

## Decision

1. Add a new **Error Report** results tab (slug `error-report`, last in the tab bar)
   that lists detected data-quality findings after a Run.

2. Findings are collected by **instrumenting the actual Run path**
   (`prepareSimulationData` and the run handler) at the exact points where data is
   excluded or coerced — the report is a by-product of one real Run, so it can never
   disagree with what the simulation computed. It is NOT an independent
   re-derivation of the inputs.

3. The report is **advisory only**: it never aborts or alters a Run, and the
   simulation output is identical whether or not diagnostics are collected. The two
   existing hard stops (the "No sized epics found for historical quarter(s)" throw at
   ~index.html:4556, and the `initiativesLoaded && epicsLoaded` + ≥1 historical + ≥1
   target preconditions) are unchanged. The report covers only Runs that **complete**;
   a fatal Run keeps today's error message.

4. Each finding carries a **severity** ∈ {`ERROR`, `WARNING`, `INFO`} and a stable
   `code`, displays the offending identifier(s), and quantifies impact where possible.

5. Known-but-unfixed model issues are **surfaced, not fixed**. In particular the
   multi-quarter forward double-count is reported at `ERROR`; the underlying
   per-key-vs-per-row unit-consistency fix is a separate future task. If/when that fix
   lands, this finding drops to `INFO`.

## Consequences

- Operators get an actionable, faithful account of what the simulator silently did to
  their data, and the report shares one source of truth with the simulation.
- Additive: no migration, no persistence, no backend (consistent with ADR-0001
  single-file HTML and ADR-0002 client-side-only).
- The report cannot explain a **fatal** Run (it does not render when the Run throws);
  the worst all-unmapped case is left to the existing throw message, which already
  names the offending historical quarter.
- Surfacing the multi-quarter double-count as `ERROR` while leaving the engine math
  unchanged means the report intentionally flags a bug the tool itself still commits,
  until the separate unit-consistency task lands.
- Instrumentation touches a hot path (`prepareSimulationData`); collection must be
  cheap and side-effect-free to preserve the "output identical with/without
  diagnostics" invariant.
```

## Mechanical toolchain to apply

N/A — toolchain already selected (`toolchain.selected: true`, selected
2026-06-21, searched 2026-06-20). PBT = fast-check + @fast-check/vitest; mutation =
N/A (single-file multi-`<script>` HTML, see ADR-0036); lint = ESLint 9 flat;
sast = eslint-plugin-security; dep_scan = npm audit (wrapped); secret_scan =
secretlint; forbidden_matcher = ast-grep; verify = `npm run verify`. apply-docs
records `toolchain_applied: "already-selected"` and applies nothing.

## Plan logistics

- **slug:** `error-report-tab`
- **user-visible goal:** After a Run completes, an "Error Report" tab lists every
  detected data-quality issue with a severity, the offending identifier(s), and a
  quantified impact — so the operator can see and fix what the simulator otherwise
  handles silently.
- **out of scope:**
  - Changing any simulation math. In particular, the multi-quarter forward
    double-count is **reported, not fixed** (the per-key-vs-per-row unit-consistency
    fix is a separate future task).
  - Changing the two existing hard stops (the "No sized epics found" throw; the
    load/quarter preconditions). Fatal Runs keep today's error message; the report
    is for completed Runs / non-fatal issues only.
  - Any pre-Run / on-load validation panel (findings come from the Run path).
  - Interactive click-to-navigate ("drill-down"): findings **display** the offending
    identifier; no navigation is required.
  - Persistence of findings (they are recomputed each Run) and any backend.
- **entry point:** the `#run-btn` Run handler in `index.html` (~line 4533). After it
  computes the simulation it collects diagnostics (instrumented within / alongside
  `prepareSimulationData` and the run handler) and renders them into a new
  `#tab-error-report` panel with a `data-tab="error-report"` button.
- **relevant files/dirs the plan may inspect:**
  - `index.html` — the whole single-file app. Key anchors: t-shirt params
    `1298-1305`; `normalizeSize` `1561`; `tshirtToPersonMonths` `1341-1345`; epic
    parse/synthetic fields `~1737-1770`; in-scope/orphan epic exclusion
    `~2078-2089`; quarters-with-epic-data filter `~2061-2073`; λ computation
    `~2091-2094`; `bucketRowsByGroups` `~2005`; target-init filter / target K
    `~2108`; constant-work effort + excluded `~1832-1945`, `~3252`; tab switching
    `~4506-4509`; run handler + capacity/iterations + warnings `~4533-4570`; preview
    object `~2123-2136`; `lastRenderState` / `lastTeamData` `~2822-2824`, `~3403`.
  - `CONTEXT.md` — glossary (with the new entries above).
  - `docs/adr/0018-tab-based-results-layout.md`, `docs/adr/0037-…` (new),
    `docs/adr/0002-client-side-only.md`, `docs/adr/0033-…`, `docs/adr/0023-…`.
  - `tests/acceptance/` — existing acceptance tests (e.g.
    `0020-phase-1-engine.test.js`, `0020-phase-2-groups-tab.test.js`) as the harness
    pattern (vitest + jsdom loading `index.html`).
- **acceptance + inner test locations:** acceptance tests under
  `tests/acceptance/0023-phase-<k>-*.test.js`; inner/unit tests co-located in
  `tests/` per the existing layout. Property tests via `@fast-check/vitest`.
- **verify command:** `npm run verify`.
- **phase-count estimate (hint only; plan sets authoritative `total_phases`):** ~4 —
  e.g. (1) diagnostics-collection scaffolding in the Run path + finding model + the
  tab/panel + empty state + the t-shirt-size and out-of-scope/orphan-epic checks;
  (2) quarter & duplicate checks (quarter-no-epics, duplicate init keys, quarter
  normalization variants, historical∩target overlap); (3) degenerate-run warnings +
  run-parameter coercion + constant-work scope exclusion + initiative/cross-ref
  integrity; (4) the multi-quarter-initiatives section (4 sub-checks) + presentation
  (severity sorting, sections, count badge).

### Acceptance criteria (lint-cleared)

- **AC-1** After a Run completes, an "Error Report" tab (button `data-tab="error-report"`,
  panel `#tab-error-report`, label "Error Report") is present beside the six existing
  tabs; the org tab remains the active/resting tab after a Run (ADR-0018 preserved).
- **AC-2** When the Run's data has no detected issues, the Error Report tab shows an
  explicit empty state ("No data issues detected.") and zero findings.
- **AC-3** For each epic whose normalised t-shirt size is not a **Recognised t-shirt
  size**, a finding identifies the epic (epic key) and its bad size value and notes it
  was excluded from λ and the bootstrap pool. For each constant-work row with an
  unrecognised size, a finding identifies the row and notes it contributed 0 PM.
- **AC-4** For each epic excluded from λ because it has neither an in-scope quarter tag
  nor an in-scope initiative link (the `!inScope || !link` site, ~index.html:2084), a
  finding gives the epic key and reason; **orphan epics** (empty parent / blank
  `_initiative_key`) are listed as their own distinct finding category.
- **AC-5** For each selected historical quarter that has initiatives but zero loaded
  in-scope epics — so its initiatives are excluded from the λ denominator (the
  `quartersWithEpicData` filter, ~index.html:2061-2073) — a finding names the quarter
  and the count of its excluded initiatives.
- **AC-6** Duplicates: (a) for each initiative key appearing in more than one
  initiatives-CSV row, a finding lists the key and its row count; (b) for each cluster
  of quarter labels that collapse to the same normalised value but appear as distinct
  raw strings, a finding lists the variants; (c) when the same normalised quarter is
  selected in both the historical and target windows, a finding flags the overlap.
- **AC-7** When λ = 0 (all in-scope historical initiatives had zero sized epics) a
  WARNING finding is shown; when total K = 0 (no initiatives match any Group) a WARNING
  finding is shown. (These correspond to the existing `console.warn`s at ~4566/~4570.)
- **AC-8** When capacity is not a finite number > 0, or the value the Run used differs
  from the entered value (coerced to 120), a finding states entered-vs-used; when
  iterations is not an integer within [1000, 10000000], or the value used differs from
  the entered value (clamped/defaulted), a finding states entered-vs-used.
- **AC-9** Initiative & cross-reference integrity — each its own finding with the
  offending identifier: (a) an initiatives row with a missing/blank initiative key;
  (b) an initiatives row with a blank quarter, or a quarter in no selected window;
  (c) an initiatives row missing team or category; (d) an epic whose initiative link
  points to no existing initiative key (dangling link — distinct from an orphan empty
  parent); (e) a selected target quarter with zero matching initiatives.
- **AC-10** When constant-work rows whose category matches no Group are excluded from
  every Group's deterministic shift (cwExcludedPM / cwExcludedRows > 0), a finding
  gives the excluded PM total and row count.
- **AC-11** A "Multi-quarter initiatives" section with four sub-checks, normalising
  quarter and key strings exactly as the engine does (`.trim()`, the detected
  initiative-key column) to avoid false positives:
  - **(a) Forward double-count — ERROR.** An initiative key appearing in more than one
    selected target-quarter row: each row is counted as an independent unit in K and
    draws its own Poisson(λ), so spanning N quarters inflates projected effort ~N×.
    Finding: initiative key + name, the list of target quarters it appears in, the row
    count, the group(s)/category it lands in, and a quantified impact line (e.g.
    "INIT-123 appears in 2 target quarters (Q2 2026, Q3 2026) → counted as 2
    independent initiatives, ~2× effort"). The engine math is NOT changed; this finding
    drops to INFO only if the separate unit-consistency fix later lands (see DC-5).
  - **(b) Partial historical-window exclusion — WARNING.** A historical initiative
    whose epics span multiple quarters where some fall outside the selected historical
    window (those out-of-window epics are silently dropped at the inScope check,
    ~index.html:2084). Finding: initiative key + name, per-quarter epic counts, which
    quarters are in vs out of window, and the count of excluded epics.
  - **(c) Multi-quarter historical initiative — INFO.** A historical initiative whose
    epics carry more than one distinct quarter, all within the window. Not wrong;
    informs the operator λ is treating it as one larger unit. Finding: key + name,
    epic count per quarter, total epics.
  - **(d) Initiative/epic quarter mismatch — WARNING.** An initiative's declared
    (initiative-CSV row) quarter doesn't match the quarter(s) of its linked epics.
    Finding: initiative key, declared quarter vs the set of epic quarters, and counts.
- **AC-12** Findings are grouped into labelled sections by check category; each finding
  carries a severity (ERROR / WARNING / INFO); sections/findings are sorted by severity
  (ERROR → WARNING → INFO); each finding displays the offending identifier(s) and a
  quantified impact where applicable; a by-severity count summary is shown (e.g. a
  badge on the tab). "Displays the offending identifier" — interactive navigation is
  out of scope.
- **AC-13** Findings are produced from the same data the Run used (collected during the
  Run path), and producing the report never aborts or alters a Run; the two existing
  hard stops are unchanged.

### Invariants (author-asserted)

- **I-1** The Error Report never changes simulation output: for identical inputs the
  histogram / percentiles / stats are identical whether or not diagnostics are
  collected, and the report never aborts or alters a Run.
- **I-2** Completeness + uniqueness: every epic / initiative / row / quarter the Run
  silently excluded or coerced for an in-scope data-quality reason appears in at least
  one finding (no silent in-scope drop goes unreported), and is not double-counted
  within the same category.
- **I-3** Every finding's severity is exactly one of {ERROR, WARNING, INFO}.
- **I-4** Every item-level finding references a concrete identifier present in the
  loaded data (epic key, initiative key, quarter label, or row index); run-level
  findings (λ=0, total K=0, capacity, iterations) reference the run-level value.
- **I-5** Detectors normalise quarter and key strings exactly as the engine does
  (`.trim()`, the detected initiative-key column), so they neither false-positive on
  formatting variants nor miss what the engine actually matched.

### Decision constraints (one-way doors, no ADR — plan formalises, does not re-decide)

- **DC-1 (externally-visible identifier):** the tab uses slug `error-report` —
  `data-tab="error-report"` button + panel `id="tab-error-report"`, label
  "Error Report", placed last in the tab bar; the org tab remains the resting/active
  tab after a Run (ADR-0018). Tabs are pre-rendered during the Run, like the others.
- **DC-2 (contract shape / no persistence):** a data-quality finding is an object with
  a stable shape — `{ code, severity, category, locators, impact, message }` (field
  names final at plan, but at minimum a `code`, a `severity`, ≥1 locator for
  item-level findings, and a human message). Findings are ephemeral — recomputed each
  Run, never persisted to disk/localStorage (consistent with ADR-0002). No persisted
  keys, no migration.
- **DC-3 (severity enum):** `severity` is exactly one of `ERROR` | `WARNING` | `INFO`;
  findings/sections are sorted ERROR → WARNING → INFO.
- **DC-4 (test-facing codes):** each check has a stable string `code` (the test-facing
  identifier the acceptance/PBT tests assert on); plan may rename but the set is a
  contract for tests. Suggested codes: `UNRECOGNIZED_SIZE_EPIC`,
  `UNRECOGNIZED_SIZE_CONSTANT_WORK`, `EPIC_OUT_OF_SCOPE`, `ORPHAN_EPIC`,
  `QUARTER_NO_EPICS`, `DUP_INITIATIVE_KEY`, `QUARTER_NORM_VARIANT`,
  `HIST_TARGET_OVERLAP`, `LAMBDA_ZERO`, `TOTAL_K_ZERO`, `CAPACITY_COERCED`,
  `ITERATIONS_CLAMPED`, `INIT_MISSING_KEY`, `INIT_BAD_QUARTER`,
  `INIT_MISSING_TEAM_OR_CATEGORY`, `DANGLING_EPIC_LINK`, `TARGET_QUARTER_NO_INITIATIVES`,
  `CONSTANT_WORK_EXCLUDED`, `MQ_FORWARD_DOUBLE_COUNT`, `MQ_PARTIAL_WINDOW_EXCLUSION`,
  `MQ_MULTI_QUARTER_HISTORICAL`, `MQ_INIT_EPIC_QUARTER_MISMATCH`.
- **DC-5 (known-bug severity policy):** the multi-quarter forward double-count
  (`MQ_FORWARD_DOUBLE_COUNT`) is reported at `ERROR` while the engine math is left
  unchanged; it is the only multi-quarter condition that is a live bug today. It is
  specified to drop to `INFO` only once the separate per-key-vs-per-row
  unit-consistency fix lands (a future task — out of scope here).

### External sources mirrored

- **Multi-quarter detection spec** (AC-11 (a)–(d)) — author/product-owner-provided
  design input. Status: **ASSUMED** (author-provided, not a third-party spec).
- **Code anchors** cited throughout (the silent-drop / coercion sites in `index.html`)
  — **VERIFIED** against `index.html` at HEAD `a8bc907` (line numbers approximate;
  re-confirm at plan/implement time, the file evolves).
- No third-party API / protocol / upstream is mirrored by this feature.

## Files the next phase MUST read

- `docs/backlog/0023-error-report-tab/handover-01-grill.md` (this file) — the
  prepared CONTEXT.md edits, ADR-0037 text, AC-* / I-* / DC-*, and plan logistics.
- `CONTEXT.md` — the glossary, including the five new entries above (definitions of
  Error Report, Data-quality finding, Severity, Recognised t-shirt size,
  In-scope/Out-of-scope epic that the ACs rely on).
- `docs/adr/0018-tab-based-results-layout.md` — the tab convention (`data-tab` slug +
  `#tab-<slug>` panel, pre-rendered during the Run, org as the resting tab) the new
  tab must follow (DC-1).
- `docs/adr/0037-error-report-advisory-diagnostics.md` (created by apply-docs) — the
  instrument-the-Run-path + advisory-only decision and its consequences.
- `docs/adr/0002-client-side-only.md` — no backend / no persistence constraint (DC-2).
- `index.html` — the single-file app; the anchors listed under "relevant files/dirs"
  are where each finding must be instrumented.

## Context the next phase needs

- The four foundational decisions (instrument the Run path; advisory-only; report-only
  the multi-quarter double-count at ERROR; report covers completed/non-fatal Runs only)
  are settled and recorded as ADR-0037 + DC-5 — plan must honour them, not re-open them.
- "Duplicate quarter" (mandated check #4) was clarified to cover three senses, all in
  scope: normalisation variants, historical∩target overlap, and duplicate initiative
  keys (AC-6 a/b/c).
- The lint surfaced two findings, both resolved: (1) the advisory-only choice vs the
  existing fatal throw — resolved by scoping the report to completed Runs / non-fatal
  issues (the all-unmapped fatal case keeps the existing throw message); (2) the
  "drillable" wording in the design input — resolved to "display the offending
  identifier", interactive navigation out of scope (AC-12).
- The task id is **0023** (the author chose 0023 over the originally-requested 0024;
  0023 is also the natural next number, so there is no numbering gap). The ADR it
  creates is **0037** (ADRs have their own sequence; the pre-existing ADR-0024,
  "2XS t-shirt size extension", is unrelated to this task's number).

## Definition of done (for apply-docs)

- The five glossary entries are present in repo-root `CONTEXT.md`, in house style.
- `docs/adr/0037-error-report-advisory-diagnostics.md` exists with the text above.
- No toolchain install/changes (already selected); `toolchain_applied:
  "already-selected"` recorded.
- `index.md` advanced to `stage: plan` with `handover-02-apply-docs.md` written,
  carrying the Plan logistics (AC-* / I-* / DC-*) forward to the plan phase.
