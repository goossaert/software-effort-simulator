---
schema: backlog-handover/v1
task_id: "0023"
produced_by_phase: plan
feature_phase: null
for_next_phase: atdd
outcome: success
reason: ""
produced_at: 2026-06-22T19:24:06Z
produced_commit: fe6c05ad4787a183175098a00c9fc8b4622d5601
total_phases: 6
---
## Summary

plan formalised task 0023 into `docs/plans/0023-error-report-tab.md` with
**`total_phases: 6`** thin vertical slices. The plan turns the lint-cleared
AC-1…AC-13, the asserted invariants I-1…I-5, the decision constraints DC-1…DC-5, and
ADR-0037 into per-phase acceptance scenarios, tagged invariants, PBT properties, and
forbidden shortcuts — it does **not** re-decide the four settled foundational
decisions (instrument the Run path; advisory-only; report the multi-quarter forward
double-count at `ERROR` without changing engine math; report covers completed/non-fatal
Runs only). The 22 test-facing `code`s (DC-4), their `category` sections, and a per-code
**Severity** assignment (DC-3; `MQ_FORWARD_DOUBLE_COUNT` = ERROR per DC-5,
`LAMBDA_ZERO`/`TOTAL_K_ZERO` = WARNING per AC-7, the rest plan-assigned reversible
defaults) are pinned in the plan's *Data models*. `index.md` is advanced to
`stage: atdd`, `current_phase: 1`.

The **6 feature-phases** (each a single coherent observable outcome, ≤3 seams,
reusing the Phase-1 collection/render seams):

1. **Tracer bullet** — `error-report` tab + panel (DC-1), the `{code,severity,category,
   locators,impact,message}` finding model (DC-2), `renderErrorReport` (sections +
   `ERROR→WARNING→INFO` sort + count badge + empty state), and the unrecognised-t-shirt-
   size findings (AC-1, AC-2, AC-3) + the advisory invariant (AC-13 / I-1).
2. **Scope & calibration** — `EPIC_OUT_OF_SCOPE`, `ORPHAN_EPIC`, `QUARTER_NO_EPICS`
   (AC-4, AC-5).
3. **Run parameters** — `LAMBDA_ZERO`, `TOTAL_K_ZERO`, `CAPACITY_COERCED`,
   `ITERATIONS_CLAMPED` (AC-7, AC-8).
4. **Duplicates & overlaps** — `DUP_INITIATIVE_KEY`, `QUARTER_NORM_VARIANT`,
   `HIST_TARGET_OVERLAP` (AC-6 a/b/c).
5. **Initiative integrity + constant work** — `INIT_MISSING_KEY`, `INIT_BAD_QUARTER`,
   `INIT_MISSING_TEAM_OR_CATEGORY`, `DANGLING_EPIC_LINK`,
   `TARGET_QUARTER_NO_INITIATIVES`, `CONSTANT_WORK_EXCLUDED` (AC-9 a-e, AC-10).
6. **Multi-quarter section + full presentation** — `MQ_FORWARD_DOUBLE_COUNT` (ERROR),
   `MQ_PARTIAL_WINDOW_EXCLUSION`, `MQ_MULTI_QUARTER_HISTORICAL`,
   `MQ_INIT_EPIC_QUARTER_MISMATCH` (AC-11 a-d) + the AC-12 cross-category sort /
   sections / count badge verified once all 22 codes exist.

## Instructions for the next phase (atdd, feature-phase 1)

1. Read the plan (`docs/plans/0023-error-report-tab.md`) **Phase 1** end-to-end: its
   Acceptance behavior (AT-1…AT-5), Public entry point, Test harness (naming +
   determinism), Proposed implementation seams, Invariants (tagged), Properties to
   PBT, Oracle strategy, Counterexamples, Forbidden shortcuts, and RED gate. The plan
   is authoritative; this handover is the index to it.
2. Write acceptance + property tests for Phase 1 under
   `tests/acceptance/0023-phase-1-*.test.js` (all `0023-`-prefixed; vitest + jsdom via
   `tests/harness.js` — `loadSimulator`, `read`, `evalIn`, `execIn`, `csv`), targeting
   the **named seams** the plan pins: `prepareSimulationData(histQs, targetQs).findings`,
   `renderErrorReport(findings)`, and the rendered DOM (`#tab-error-report`, the
   `.tab-btn[data-tab="error-report"]`). Do **not** target private detector helper
   names or a fixed per-finding DOM tree — assert on finding-level fields and panel
   text content (so Phase 6's sectioning does not break frozen Phase-1 tests).
3. PBT is enabled (`pbt.enabled: true`, `fast-check` via `@fast-check/vitest`;
   `import_symbol` = `fc.property|test.prop|it.prop`). Phase 1 declares **two**
   parametric properties (the unrecognised-size partition; the advisory engine-equality
   I-1) — author a `fc.property`/`it.prop` generator test for each (the gate's PBT
   structural floor (f) checks one exists per non-N/A property).
4. Confirm a **stable RED** across `test_immutability.flakiness_reruns` (5) and persist
   the RED logs to `docs/atdd-logs/0023-error-report-tab-phase-1-*-red.log` with a
   `command:` header (the gate re-runs them verbatim). Then hand to implement.

## Files the next phase MUST read

- `docs/plans/0023-error-report-tab.md` — **the** behavioral spec: per-phase
  acceptance scenarios, tagged invariants, PBT properties, oracle class, counterexamples,
  forbidden shortcuts, RED gate, and the *Data models* finding shape + 22 codes +
  severity map. This is the input to **every** atdd cycle (all 6 feature-phases).
- `CONTEXT.md` — the glossary; use these exact terms in test names and assertions
  (**Error Report**, **Data-quality finding**, **Severity**, **Recognised t-shirt
  size**, **In-scope/Out-of-scope epic**, **Bootstrap pool**, **Poisson λ**, **K**,
  **Run**, **Group**, **Constant work**, **Tab**, **Tab panel**).
- `docs/adr/0037-error-report-advisory-diagnostics.md` — instrument-the-Run-path +
  advisory-only spec (single source of truth; report-only the double-count; completed
  Runs only).
- `docs/adr/0018-tab-based-results-layout.md` — the `data-tab`/`#tab-<slug>` tab
  convention DC-1 follows; org stays the resting tab.
- `docs/adr/0002-client-side-only.md` — no backend / no persistence (DC-2).
- `tests/harness.js` + `tests/acceptance/0020-phase-1-engine.test.js` — the exact
  vitest + jsdom harness pattern to copy (load `index.html`, drive page-realm
  functions via the lexical-binding bridge, assert on returned data / jsdom DOM).
- `index.html` — the Run path being instrumented (anchors in the plan's *Relevant
  existing files*; line numbers approximate — re-confirm).

## Context the next phase needs

Autonomous decisions taken this phase (no user; recorded per LOOP-MODE.md):

1. **Phase count = 6 (authoritative; grill hinted ~4).** The 22 detectors split into
   6 coherent slices by the Run-path site they instrument + the section they render
   into, each with one observable outcome and reusing the Phase-1 seams. I merged the
   AC-12 presentation contract into Phase 1's render *mechanics* (so the section/sort/
   badge structure is stable from the first slice and later phases add no render
   refactor) and verify the full cross-category ordering in Phase 6, where all
   categories finally coexist — avoiding a thin presentation-only final phase.

2. **Seam design (the test contract).** `prepareSimulationData(histQs, targetQs)` gains
   an **additive** `findings: Finding[]` field (all existing returned values unchanged
   in name/type/value — existing 0020/0021 tests keep passing); it carries all
   data-level findings. `collectRunLevelFindings({enteredCapacity, usedCapacity,
   enteredIterations, usedIterations})` is a new pure named seam for the
   capacity/iterations entered-vs-used findings (codes 8-9), which genuinely live in the
   run handler. `renderErrorReport(findings)` paints `#tab-error-report`. The
   run-button handler concatenates the two finding sources and calls
   `renderErrorReport` inside the completed-Run path (so a fatal Run never reaches it).
   `LAMBDA_ZERO`/`TOTAL_K_ZERO` are placed in `prepareSimulationData.findings` (derived
   from the returned `lambda`/`kPerGroup`) rather than the run handler, for single-source
   testability — AC-7's severity (WARNING) is preserved.

3. **Per-code severity defaults (DC-3, reversible).** Only `MQ_FORWARD_DOUBLE_COUNT`
   (ERROR, DC-5) and `LAMBDA_ZERO`/`TOTAL_K_ZERO` (WARNING, AC-7) are fixed by the
   handover. I assigned the other 19 severities by the CONTEXT.md **Severity** rule
   (in-scope silent drop / forecast-distorting ⇒ ERROR; likely-wrong/partial ⇒ WARNING;
   structural-but-not-wrong ⇒ INFO) — notably `UNRECOGNIZED_SIZE_EPIC` = ERROR (an
   in-scope epic silently dropped from λ + Bootstrap pool), `UNRECOGNIZED_SIZE_CONSTANT_
   WORK` = WARNING, `EPIC_OUT_OF_SCOPE`/`TARGET_QUARTER_NO_INITIATIVES`/
   `MQ_MULTI_QUARTER_HISTORICAL` = INFO, the rest WARNING. These are a non-persisted
   display attribute (DC-2: no migration), so they are reversible and may be re-tuned in
   a later phase/task without an ADR; the full table is in the plan's *Data models*.

4. **No one-way-door block.** DC-1…DC-5 + ADR-0037/0018/0002 cover every irreversible
   surface (the externally-visible tab identifier, the contract shape, the severity
   enum/sort, no persistence). Nothing irreversible was left unaligned, so no `blocked`.

5. **`locators` shape.** Pinned as `Locator[]` of `{kind: 'epic'|'initiative'|
   'quarter'|'row'|'run', id: string}` — DC-2 left the field names final-at-plan; this
   satisfies "≥1 locator for item-level findings, the run-level value for run-level"
   (I-4). A `row` locator's `id` may be the array index or the row's key (either
   concretely references the row).

6. **Oracle class (a) for every phase.** Each detector has a cheap, hand-verifiable
   oracle (a constructed input → a known expected finding); no phase is oracle-free, so
   the (h) oracle-free gate (off in this repo anyway) does not apply. The advisory I-1
   invariant is layered as a metamorphic engine-equality PBT but is not the phase's core
   oracle.

7. **Mutation N/A.** `mutation.enabled: false` and `toolchain.layers.mutation.status:
   "n/a"` (single-file multi-`<script>` HTML, ADR-0036). Each phase's DoD records the
   mutation line as N/A and leans on the per-rule PBT + the review negative-control; the
   forcing gate is satisfied by the recorded N/A.

Boot smoke: **passed (no-op).** `smoke_command` is empty (logged no-op per LOOP-MODE.md);
the minimal base check confirmed `index.html` is present (4641 lines) and the working
tree was clean at the prior phase's commit `fe6c05a`. plan touches only docs + backlog
files, so the app's build/boot state is unaffected.

Toolchain: already selected (`toolchain.selected: true`); plan installs/changes nothing.

## Definition of done (for atdd, feature-phase 1)

- Acceptance + property tests for **Phase 1** exist under
  `tests/acceptance/0023-phase-1-*.test.js`, all `0023-`-prefixed, targeting the named
  seams and asserting outcomes observable from outside (finding content + rendered
  panel), per the plan's Phase-1 Acceptance behavior and PBT properties.
- The RED gate is met: each committed test fails for the plan's stated reason, **stably**
  across the 5 flakiness reruns, with RED logs persisted under `docs/atdd-logs/` carrying
  a verbatim `command:` header.
- `index.md` is advanced to `stage: implement`, `current_phase: 1`, with
  `handover-NN-atdd-p1.md` written.
