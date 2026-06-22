---
schema: backlog-handover/v1
task_id: "0023"
produced_by_phase: atdd
feature_phase: 1
for_next_phase: implement
outcome: success
reason: ""
produced_at: 2026-06-22T19:45:25Z
produced_commit: 641f730f8f65d31d3cf8dbd990b17812358d80d0
total_phases: 6
---
## Summary

atdd authored the **Phase 1** failing test set for task 0023 (Error Report tab):
the acceptance suite `tests/acceptance/0023-phase-1-error-report-tab.test.js`
(AT-1…AT-5, 6 tests) and the inner/property suite
`tests/acceptance/0023-phase-1-finding-model-property.test.js` (7 tests including
the **two** `fast-check` properties the plan declares). A **stable RED** was
confirmed across the configured 5 flakiness reruns — acceptance **5/5 exit 1**
(6 failed), inner **5/5 exit 1** (7 failed) — and the RED logs (with verbatim
`command:` headers the gate re-runs) are persisted under `docs/atdd-logs/`. Tests
target only the plan's named seams and assert on outcomes observable from outside
(finding-level fields + rendered panel text). `index.md` is advanced to
`stage: implement`, `current_phase: 1`.

## Instructions for the next phase (implement, feature-phase 1)

Implement the **Phase 1** slice in `index.html` so every committed Phase-1 test
goes green — **without editing any `tests/**` file** (the test commit is the
immutability boundary; the gate rewinds an implement commit that stages a test).
The tests pin this contract:

1. **Tab markup (DC-1).** Add `<button class="tab-btn" data-tab="error-report">Error Report</button>`
   as the **last** child of `.tab-bar` (after `groups`), and a panel
   `<div id="tab-error-report" class="tab-panel" style="display:none"> … </div>`.
   org stays `.active`; add `#tab-error-report` to the run-handler tab-reset block
   (lines ~4611-4621) so it is hidden on every completed Run alongside the other
   non-org panels.
2. **`prepareSimulationData(histQuarters, targetQuarters)` — additive `findings`
   field.** Return a new `findings: Finding[]` (all existing returned values —
   `lambda`, `epicSizingDist`, `kPerGroup`, `fixedEffortPerGroup`, `preview` —
   unchanged in name/type/value; the existing 0020/0021/0022 suites must keep
   passing). For Phase 1 it carries codes **1-2**:
   - `UNRECOGNIZED_SIZE_EPIC` (severity `ERROR`): one finding per **in-scope** Epic
     whose `normalizeSize(epic._tshirt_size)` is not a key of `T_SHIRT_PARAMS`
     (collected at the in-scope epic loop, ~`index.html:2081-2089` / `2098-2105` —
     the exact site the engine drops it). Locator `{ kind:'epic', id:<epic._epic_key> }`;
     `message`+`impact` must note exclusion from **Poisson λ** and the **Bootstrap
     pool** (the tests match `/bootstrap pool/i` and `/λ|lambda|poisson/i` against
     `message + impact`).
   - `UNRECOGNIZED_SIZE_CONSTANT_WORK` (severity `WARNING`): one finding per
     **Constant work** row in a **target** quarter whose
     `normalizeSize(row.tshirt_size || row.t_shirt_size)` is unrecognised (it
     contributes `0` PM via `tshirtToPersonMonths`'s miss branch). A `row` locator;
     `message`+`impact` must note it contributed `0` PM (tests match `/\b0\b/` and
     `/pm|person-month/i`). This is independent of Group membership.
   - Recognition MUST go through `normalizeSize` + `T_SHIRT_PARAMS` (single source —
     I-5/ADR-0037): a recognised size differing only by case/trailing space
     (`' m '`, `'xl+'`) must NOT be flagged.
3. **`renderErrorReport(findings)`** paints `#tab-error-report`: render
   `No data issues detected.` when `findings` is empty; otherwise group by
   `category` into labelled sections, sort `ERROR → WARNING → INFO` then a stable
   secondary key (`code`, then first-locator `id`) — **explicit sort, never Map/Set
   iteration order** — show a by-severity count badge, and display each finding's
   locator id(s) + message. (Phase-1 tests assert the empty-state text and that a
   finding's Epic key appears in the panel; the full cross-category presentation is
   verified in Phase 6 — build the mechanics now so later phases add no refactor.)
4. **Finding contract (DC-2 / I-3 / I-4).** `Finding = { code, severity, category,
   locators, impact, message }`; `severity ∈ {ERROR,WARNING,INFO}`;
   `Locator = { kind, id }` (both strings); item-level findings carry `locators.length
   >= 1`; `message` non-empty; `category` non-empty.
5. **Advisory (AC-13 / I-1).** Collection is **read-only** — do not mutate
   `parsedEpics`, `editedInitiatives`, `editedConstantWork`, or any engine input,
   and do not change any value `prepareSimulationData` returns to the engine.
   `runSimulation` takes no `findings` argument and reads none.
6. Wire the run-button handler to concat `prepareSimulationData(...).findings` (and,
   in later phases, `collectRunLevelFindings(...)`) and call `renderErrorReport(all)`
   inside the **completed-Run** path (after the engine ran), so a fatal Run never
   reaches it.

Then run `npm run verify` (hermetic, network-disabled, `npm ci`); it must exit 0
with every enabled `correctness_gate` layer green before you may write
`outcome: success`.

## Files the next phase MUST read

- `docs/plans/0023-error-report-tab.md` — **Phase 1** is the authoritative spec
  (Acceptance behavior, Public entry point, seams, Invariants, PBT properties,
  Oracle strategy, Counterexamples, Forbidden shortcuts, RED gate, DoD) plus *Data
  models* (finding shape + 22 codes + severity map). Implement only the Phase-1
  rows (codes 1-2 + the tab/render mechanics).
- `tests/acceptance/0023-phase-1-error-report-tab.test.js` — the frozen acceptance
  contract (AT-1…AT-5). **Do not edit.**
- `tests/acceptance/0023-phase-1-finding-model-property.test.js` — the frozen
  inner/property contract (2 `fast-check` properties + triangulation + finding
  contract). **Do not edit.**
- `docs/atdd-logs/0023-error-report-tab-phase-1-acceptance-red.log`,
  `…-inner-red.log`, `…-flakiness.log` — the RED evidence (commands + exit codes +
  the stable-RED proof the gate re-derives).
- `CONTEXT.md` — glossary; use the exact terms (**Error Report**, **Data-quality
  finding**, **Severity**, **Recognised t-shirt size**, **Bootstrap pool**,
  **Poisson λ**, **Constant work**, **Tab**, **Tab panel**, **Run**).
- `docs/adr/0037-…` (instrument-the-Run-path + advisory-only), `docs/adr/0018-…`
  (tab convention), `docs/adr/0002-…` (no persistence).
- `index.html` — the Run path to instrument: tab bar `~1024-1031`, tab-reset
  `~4611-4621`, `prepareSimulationData` `2047-2139` (in-scope epic loop
  `2081-2105`), `normalizeSize` `1561`, `T_SHIRT_PARAMS` `1298`,
  `tshirtToPersonMonths` `1341`, `runSimulation` `2485`. (Line numbers approximate —
  re-confirm.)
- Test commit SHA: derive via
  `git log -1 --format=%H -- docs/backlog/0023-error-report-tab/handover-04-atdd-p1.md`.

## Context the next phase needs

Autonomous decisions taken this phase (no user; recorded per LOOP-MODE.md):

1. **Seam contract (decided at Step 4/7 with no user).** The tests target exactly the
   plan's named seams — `prepareSimulationData(histQs, targetQs).findings` (additive),
   `renderErrorReport(findings)`, and the rendered jsdom DOM (`#tab-error-report`, the
   `.tab-btn[data-tab="error-report"]`). **No private detector helper name** and **no
   fixed per-finding DOM tree** is asserted (the plan forbids both; finding-level
   fields + panel text content are asserted instead, so Phase 6's sectioning will not
   break these frozen tests). These are stable component/use-case seams pinned by the
   plan's *Data models → Collection seams*, not incidental ones. `collectRunLevelFindings`
   is **not** exercised in Phase 1 (it carries codes 8-9, introduced in Phase 3).

2. **AT-1 is asserted on the freshly-loaded DOM, not by driving the async Run button.**
   The tab button/panel are static pre-rendered markup (ADR-0018), and "org is the
   resting tab / `#tab-error-report` hidden" is the page-load default = the post-Run
   resting state. Driving `#run-btn` (a `setTimeout(…30ms)` path needing
   MultiSelect-widget selection + full CSV mount) was **deliberately avoided** to keep
   the frozen RED set deterministic — an order-dependent/async test must never enter the
   immutable set (Step 3 stability rule). This matches the plan's instruction to "reach
   the behavior through the named seams" and the repo's 0020/0021/0022 precedent. The
   run-handler reset-block wiring (add `#tab-error-report` to lines ~4611-4621) is still
   required of implement and is covered by the markup-default assertions.

3. **The advisory I-1 equality is made RED for the right reason by asserting findings
   existence first.** Both AT-5 and Property 2 are genuine engine-equality invariants
   (the engine already ignores an unknown `findings` field, so equality alone is
   green-on-base). To satisfy the "every committed test is RED" rule, each first asserts
   `Array.isArray(prepareSimulationData(...).findings)` — which is `false` on the base
   (findings undefined) — so the file is RED for the *advisory-not-yet-collected*
   reason, and post-impl both the array check and the equality hold. The engine seed is
   pinned by stubbing `Date.now` in the page realm (`runSimulation` re-seeds from
   `Date.now()` internally, line ~2487), making the two Runs byte-identical and the
   equality deterministic.

4. **Oracle is engine-derived (I-5).** Property 1's recognised/unrecognised oracle is
   computed through the page's own `normalizeSize` + `T_SHIRT_PARAMS` (never a
   hand-reimplemented recognition test), and the Recognised t-shirt size set is read
   from the loaded window (`Object.keys(T_SHIRT_PARAMS)`), so the test tracks what the
   engine actually excludes.

5. **PBT (gate sub-check (f)).** `pbt.enabled: true`, framework `fast-check` via
   `@fast-check/vitest` `test.prop` (`pbt.import_symbol = fc.property|test.prop|it.prop`).
   Both non-N/A Phase-1 properties have a committed `test.prop` generator test (Property
   1 = unrecognised-size partition; Property 2 = advisory I-1 engine equality). Shrinking
   left ON; both shrink to the minimal counterexample `[]` (empty epic-size array) on the
   base. `numRuns` set to 50 (P1) / 25 (P2) to bound wall-clock; the domain is covered by
   `constantFrom` over recognised+junk pools plus `fc.string()`.

6. **Mutation N/A.** `mutation.enabled: false`; `toolchain.layers.mutation.status: "n/a"`
   (single-file multi-`<script>` HTML, ADR-0036). Phase DoD records mutation as N/A;
   adequacy leans on the per-rule PBT + the review negative-control. `oracle_free.enabled:
   false` — no `(c)` oracle-free phase, so sub-check (h) does not apply.

7. **No one-way door.** Phase 1 introduces no irreversible surface beyond what DC-1…DC-5
   + ADR-0037/0018/0002 already aligned (the `error-report` identifier, the finding
   contract shape, the severity enum/sort, no persistence). Nothing unaligned ⇒ no
   `blocked`.

Boot smoke: **passed (no-op).** `smoke_command` is empty (logged no-op per LOOP-MODE.md);
the minimal base check confirmed `index.html` present (4641 lines), working tree clean at
`641f730`, and `fast-check`/`vitest` installed. atdd touches only test files + docs/backlog
+ atdd-logs, so the app's build/boot state is unaffected.

Toolchain: already selected (`toolchain.selected: true`); atdd installs/changes nothing.

## Definition of done (for implement, feature-phase 1)

- All Phase-1 tests pass (`npx vitest run tests/acceptance/0023-phase-1-error-report-tab.test.js`
  and `…/0023-phase-1-finding-model-property.test.js`), stable green incl. randomized order;
  the pre-existing 0020/0021/0022 suites remain green (additive `findings`; engine values
  unchanged — I-1).
- No `tests/**` file is edited or staged by the implement commit (gate sub-check (a)).
- `npm run verify` exits 0 under the hermetic, network-disabled fresh checkout (`npm ci`);
  every enabled `correctness_gate` layer green (lint/SAST/dep/secret/forbidden-pattern;
  typecheck/sanitizer N/A); no production import from `tests/`/`fixtures/`/`fakes/`, no
  identity special-casing (gate sub-check (d)).
- Mutation: **N/A** (recorded). PBT floor (f) satisfied by the two committed properties.
- Command, exit code, and log output recorded as artifacts.
