# Feature: Error Report tab

Created at: 2026-06-22T19:24:06Z

## Context

This feature belongs to the **Result tabs** area of the simulator (`CONTEXT.md` →
*Result tabs*: **Tab**, **Tab panel**, **Error Report**, **Data-quality finding**,
**Severity**). It adds the seventh **Tab** — **Error Report** — that lists the
**Data-quality finding**s the simulator detects while it runs, i.e. the **Epic**s,
**Initiative**s, rows, and **Quarter**s it silently excludes or coerces today.

Constraining ADRs (look these up; do not re-narrate them here):

- **ADR-0037** (`docs/adr/0037-error-report-advisory-diagnostics.md`) — the spec this
  plan formalises: findings are collected by **instrumenting the actual Run path**
  (single source of truth, never an independent re-derivation); the report is
  **advisory only** (never aborts or alters a **Run**); the multi-quarter forward
  double-count is **reported at `ERROR` without changing engine math**; the report
  covers **completed Runs only** (a fatal Run keeps today's error message).
- **ADR-0018** (`docs/adr/0018-tab-based-results-layout.md`) — the tab convention:
  a `data-tab="<slug>"` button paired with an `id="tab-<slug>"` **Tab panel**,
  every panel pre-rendered during the **Run**, the org tab the resting tab after a Run.
- **ADR-0002** (`docs/adr/0002-client-side-only.md`) — no backend, no persistence.
- **ADR-0001** (`docs/adr/0001-single-file-html-app.md`) — the whole app is one
  `index.html`; instrumentation lives in the existing inline `<script>` blocks.
- **ADR-0023 / ADR-0033** (constant-work deterministic shift; per-Group scoping) and
  **ADR-0029** (user-defined **Group**s) — the engine concepts the findings describe.

### Decision constraints carried from the grill handover (formalised here, not re-decided)

- **DC-1 — externally-visible identifier.** The tab uses slug `error-report`:
  `data-tab="error-report"` button, panel `id="tab-error-report"`, label
  `Error Report`, placed **last** in the tab bar; the org tab remains the
  active/resting tab after a Run. Pre-rendered during the Run like the others.
  Formalised in *Public entry point* (Phase 1) and *Data models → Tab identifier*.
- **DC-2 — contract shape / no persistence.** A **Data-quality finding** is the
  object `{ code, severity, category, locators, impact, message }` (see *Data models*).
  Findings are recomputed each **Run** and **never persisted** (no `localStorage`, no
  file, no backend — ADR-0002). Formalised in *Data models → Finding*.
- **DC-3 — severity enum + sort.** `severity` is exactly one of
  `ERROR` | `WARNING` | `INFO`; sections and findings are sorted `ERROR` → `WARNING`
  → `INFO`. Formalised in *Data models → Severity* and Phase 6 (presentation).
- **DC-4 — test-facing codes.** Every check has a stable string `code`; the 22 codes
  are the contract the acceptance/PBT tests assert on (see *Data models → Finding
  codes*). A `code` may be renamed only by editing this plan, never silently.
- **DC-5 — known-bug severity policy.** `MQ_FORWARD_DOUBLE_COUNT` is reported at
  `ERROR` while the engine math is unchanged; it drops to `INFO` only once the
  separate per-key-vs-per-row unit-consistency fix lands (out of scope here).
  Formalised in Phase 6.

No DC and no ADR is overturned by this plan; all are formalised below. There is no
persisted data model, key, migration, money representation, or
authorization/tenancy concern in this feature (ADR-0002), so there is no
unaligned one-way door.

## Authoritative references

N/A — no external behavior mirrored. This is a pure internal feature: every finding
describes the simulator's **own** silent-drop / coercion behavior, defined entirely
by the existing `index.html` Run path (the code anchors cited under *Relevant
existing files*). There is no protocol, RFC, vendor API, or upstream library whose
behavior is being reproduced, so the table is empty and no parity test is required.
The oracle for every detector is therefore a **cheap, hand-verifiable** one (a
constructed input has a known expected finding) — see each phase's *Oracle strategy*.

## User-visible behavior

After a **Run** completes, a new **Error Report** tab (last in the tab bar) lists
every detected **Data-quality finding** — each with a **Severity**, the offending
identifier(s) (an **Epic** key, **Initiative key**, **Quarter** label, or row), and a
quantified impact where applicable — grouped into labelled sections and sorted
`ERROR` → `WARNING` → `INFO`, with a by-severity count badge. When the Run's data has
no detected issues, the tab shows an explicit empty state (`No data issues
detected.`). The org tab remains the active tab after a Run; opening the Error Report
is one click. Producing the report **never** aborts or alters the Run — the histogram,
percentiles, and stats are identical whether or not diagnostics are collected — and a
**fatal** Run (the existing "No sized epics found…" throw) keeps today's error message
and renders no report.

## Scope

### In scope

- A seventh read-only **Tab** (`error-report`) rendered on every completed **Run**.
- A **Data-quality finding** model `{ code, severity, category, locators, impact,
  message }` and the 22 detectors (DC-4) listed in *Data models → Finding codes*.
- Collecting findings by instrumenting the **Run path** (`prepareSimulationData` and
  the run-button handler) — the same data the simulation used.
- Rendering: labelled sections per category, severity sort (DC-3), a by-severity
  count summary (badge), and the empty state.

### Out of scope

- **Changing any simulation math.** In particular the multi-quarter forward
  double-count is **reported, not fixed** (DC-5; the per-key-vs-per-row
  unit-consistency fix is a separate future task).
- **Changing the two existing hard stops** — the "No sized epics found for historical
  quarter(s)" throw (`index.html` ~4556-4564) and the
  `initiativesLoaded && epicsLoaded` + ≥1 historical + ≥1 target preconditions. Fatal
  Runs keep today's error message; the report is for completed Runs / non-fatal issues.
- Any **pre-Run / on-load** validation panel (findings come from the Run path only).
- **Interactive click-to-navigate** ("drill-down"): findings *display* the offending
  identifier; no navigation is built.
- **Persistence** of findings (recomputed each Run) and any backend (ADR-0002).
- The Team Level / Team Projections per-team diagnostic surfaces — the Error Report is
  an **org-Run** report (it reads the org-level `prepareSimulationData` + the run
  handler). Per-team re-derivation is out of scope.

## Relevant existing files

Claude may inspect:

- `index.html` — the single-file app. Key anchors (line numbers approximate; the file
  evolves — re-confirm at implement time):
  - tab bar markup `1024-1031`; **Tab panel** divs `1033-1074` (org `1034`, teams
    `1053`, projections `1058`, initiatives `1064`, constant-work `1068`, groups
    `1074`); the `.tab-btn` CSS `517-531`.
  - tab-switch delegated handler `4505-4521`; run-button handler `4533-4637`
    (capacity coerce `4540`, iterations clamp `4541-4542`, fatal throw `4556-4564`,
    `λ = 0` warn `4565-4567`, total-K warn `4568-4571`, run-end tab reset `4611-4621`).
  - `prepareSimulationData` `2047-2139` (historical filter `2051-2053`,
    `quartersWithEpicData` `2061-2065`, `epicCounts` denominator `2070-2076`,
    in-scope/`!link` epic loop `2081-2089`, λ `2091-2094`, `epicSizingDist`
    `2097-2105`, target filter + `bucketRowsByGroups` `2108-2109`, constant-work
    excluded `2117`, `preview` `2123-2136`).
  - `normalizeSize` `1561`; `tshirtToPersonMonths` `1378` (unknown → `0` PM warn);
    `T_SHIRT_PARAMS` `1229`; `normalizeCategory` `1554`; epic synthetic-field parse
    `1735-1745` (`_initiative_key`, `_tshirt_size`, `_quarter`, `_epic_key`);
    `bucketRowsByGroups` `2005`; `getConstantWorkExcluded` `1916-1945` (returns
    `{ pm, rows }`); `extractQuarters` `1142`.
- `CONTEXT.md` — the glossary (the new entries this feature depends on).
- `docs/adr/0037-…`, `docs/adr/0018-…`, `docs/adr/0002-…`.
- `tests/harness.js` and `tests/acceptance/0020-phase-1-engine.test.js` (the
  vitest + jsdom harness pattern: `loadSimulator`, `read`, `evalIn`, `execIn`, `csv`).

Claude should not inspect unless needed:

- The charting / marker code (`markersPlugin`, `ensureCapacityMarker`, the Chart.js
  wiring) — the Error Report renders no chart.
- The CSV-format-detection internals beyond the named helpers above.

## Existing patterns to follow

- **Acceptance tests live in:** `tests/acceptance/` (vitest + jsdom; each file loads
  `index.html` via `tests/harness.js`'s `loadSimulator()` and drives page-realm
  functions with `evalIn` / `execIn` / `read`, asserting on returned data or on the
  jsdom DOM). Property tests co-locate here too (e.g.
  `tests/acceptance/0022-empirical-default-params-property.test.js`).
- **Unit/integration tests live in:** `tests/` (e.g. `tests/verification/*`); pure
  inner tests may live directly under `tests/`. This feature's inner + property tests
  go under `tests/acceptance/` alongside the acceptance tests, all `0023-`-prefixed.
- **Fixture/fake pattern:** none — there is no external system. Tests construct
  minimal in-memory CSVs with `csv(...)` and mount state via
  `loadInitiativesCSV(...)` / direct `parsedEpics =` / `editedConstantWork =`
  assignments through `execIn`, exactly as the 0020/0021 suites do. No fake adapter,
  no env-var injection.
- **Route/controller/use-case pattern:** vanilla DOM. New behavior is added as named
  top-level functions in the existing inline `<script>` (so the harness can reach them
  via the lexical-binding bridge) plus markup in the results region.
- **Verification command:** `npm run verify` (runs `eslint --max-warnings 0`,
  `ast-grep` forbidden-pattern scan, `npm run scan:deps`, `secretlint`, then
  `vitest run`).

> **Ubiquitous-language rule — applies to all sections below:** every entity, field,
> and behavior name in Data models, acceptance scenarios, Behavioral rules, and
> Invariants matches the `CONTEXT.md` glossary verbatim — **Error Report**,
> **Data-quality finding**, **Severity**, **Recognised t-shirt size**, **In-scope
> epic / Out-of-scope epic**, **Epic**, **Initiative**, **Initiative key**,
> **Quarter**, **Group**, **Constant work**, **Bootstrap pool**, **Poisson λ**, **K**,
> **Run**, **Capacity**, **Iteration**, **Tab**, **Tab panel**.

## Data models

This feature has **no persistence layer** (ADR-0002 / DC-2): findings are ephemeral,
recomputed each **Run**, never serialised. The "data models" are the in-memory
**Data-quality finding** shape and the test-facing code/severity contract. This
section formalises DC-1…DC-5; it does not overturn them.

### Tab identifier (DC-1)

```
button: <button class="tab-btn" data-tab="error-report">Error Report</button>   // last in .tab-bar
panel:  <div id="tab-error-report" class="tab-panel" style="display:none"> … </div>
```

The org tab keeps the `.active` class after a Run; the run handler's tab-reset block
hides `#tab-error-report` along with the other non-org panels.

### Finding (DC-2)

```
Finding = {
  code:     string,                 // one of the 22 codes below (DC-4) — stable, test-facing
  severity: 'ERROR' | 'WARNING' | 'INFO',   // DC-3
  category: string,                 // the section label this finding is grouped under
  locators: Locator[],              // >= 1 for item-level findings; the run-level value for run-level findings
  impact:   string,                 // quantified where applicable (e.g. "excluded from λ and the Bootstrap pool"); may be ''
  message:  string,                 // human-readable, non-empty
}
Locator = { kind: 'epic' | 'initiative' | 'quarter' | 'row' | 'run', id: string }
```

`category` values (the section labels) and the code→severity map are the contract:

### Finding codes (DC-4) and severity assignment (DC-3 / DC-5)

Severities other than the two **fixed** by the handover (`MQ_FORWARD_DOUBLE_COUNT`
= `ERROR` per DC-5; `LAMBDA_ZERO` / `TOTAL_K_ZERO` = `WARNING` per AC-7) are
**plan-assigned defaults**, chosen by the rule "an in-scope item silently dropped /
forecast-distorting ⇒ `ERROR`; likely-wrong or partially-excluded data ⇒ `WARNING`;
structural note that is not wrong ⇒ `INFO`" (CONTEXT.md → **Severity**). They are a
**reversible** display attribute (no persistence, no migration — DC-2), so they may be
re-tuned in a later phase or task without re-opening an ADR.

| # | code | severity | category (section label) | phase |
|---|---|---|---|---|
| 1 | `UNRECOGNIZED_SIZE_EPIC` | ERROR | T-shirt sizing | 1 |
| 2 | `UNRECOGNIZED_SIZE_CONSTANT_WORK` | WARNING | T-shirt sizing | 1 |
| 3 | `EPIC_OUT_OF_SCOPE` | INFO | Scope & calibration | 2 |
| 4 | `ORPHAN_EPIC` | WARNING | Scope & calibration | 2 |
| 5 | `QUARTER_NO_EPICS` | WARNING | Scope & calibration | 2 |
| 6 | `LAMBDA_ZERO` | WARNING | Run parameters | 3 |
| 7 | `TOTAL_K_ZERO` | WARNING | Run parameters | 3 |
| 8 | `CAPACITY_COERCED` | WARNING | Run parameters | 3 |
| 9 | `ITERATIONS_CLAMPED` | WARNING | Run parameters | 3 |
| 10 | `DUP_INITIATIVE_KEY` | WARNING | Duplicates & overlaps | 4 |
| 11 | `QUARTER_NORM_VARIANT` | WARNING | Duplicates & overlaps | 4 |
| 12 | `HIST_TARGET_OVERLAP` | WARNING | Duplicates & overlaps | 4 |
| 13 | `INIT_MISSING_KEY` | WARNING | Initiative integrity | 5 |
| 14 | `INIT_BAD_QUARTER` | WARNING | Initiative integrity | 5 |
| 15 | `INIT_MISSING_TEAM_OR_CATEGORY` | WARNING | Initiative integrity | 5 |
| 16 | `DANGLING_EPIC_LINK` | WARNING | Initiative integrity | 5 |
| 17 | `TARGET_QUARTER_NO_INITIATIVES` | INFO | Initiative integrity | 5 |
| 18 | `CONSTANT_WORK_EXCLUDED` | WARNING | Constant work | 5 |
| 19 | `MQ_FORWARD_DOUBLE_COUNT` | ERROR | Multi-quarter initiatives | 6 |
| 20 | `MQ_PARTIAL_WINDOW_EXCLUSION` | WARNING | Multi-quarter initiatives | 6 |
| 21 | `MQ_MULTI_QUARTER_HISTORICAL` | INFO | Multi-quarter initiatives | 6 |
| 22 | `MQ_INIT_EPIC_QUARTER_MISMATCH` | WARNING | Multi-quarter initiatives | 6 |

### Collection seams (the test contract; honour the ADR-0037 single-source rule)

These are the stable named seams the tests target. A private helper may be renamed
freely, but these signatures are a contract:

- **`prepareSimulationData(histQuarters, targetQuarters)`** returns, **additively**, a
  new `findings: Finding[]` field (all existing fields — `lambda`, `epicSizingDist`,
  `kPerGroup`, `fixedEffortPerGroup`, `preview` — are unchanged in name, type, and
  value). It carries every **data-level** finding (codes 1-5, 6-7, 10-22): collected
  from the very arrays/Sets it already builds (`histInits`, `histKeys`,
  `quartersWithEpicData`, `epicCounts`, the in-scope decisions, `parsedEpics`,
  `targetInits`, `bucketRowsByGroups` output, `getConstantWorkExcluded`). It must
  **not** mutate any engine input or change any returned engine value (I-1).
- **`collectRunLevelFindings({ enteredCapacity, usedCapacity, enteredIterations,
  usedIterations })`** returns `Finding[]` for codes 8-9 (`CAPACITY_COERCED`,
  `ITERATIONS_CLAMPED`) — the entered-vs-used comparison that lives in the run handler.
- **`renderErrorReport(findings)`** paints `#tab-error-report`: groups findings into
  labelled sections by `category`, sorts sections and findings `ERROR`→`WARNING`→`INFO`
  with a deterministic secondary key (the `code`, then the first locator `id`), shows a
  by-severity count badge, and renders `No data issues detected.` when `findings` is
  empty.
- The **run-button handler** concatenates `prepareSimulationData(...).findings` with
  `collectRunLevelFindings(...)` and calls `renderErrorReport(all)` inside the same
  completed-Run path, after the engine has run (so a fatal Run never reaches it).

---

## Phase 1: Error Report tab renders findings (tracer bullet: tab + model + render + unrecognised-size)

### Acceptance behavior

Scenario AT-1: the Error Report tab is present and org stays the resting tab
Given a completed **Run** (any valid inputs),
When the run handler finishes,
Then a `.tab-btn[data-tab="error-report"]` button labelled `Error Report` exists as
the **last** tab in `.tab-bar`, a panel `#tab-error-report` exists, and the org tab
(`data-tab="org"`) still carries `.active` while `#tab-error-report` is `display:none`.

Scenario AT-2: empty state when the data is clean
Given a **Run** whose inputs produce **no** detected findings (all epics carry a
**Recognised t-shirt size**, all in scope, no coercion),
When `renderErrorReport([])` paints the panel,
Then `#tab-error-report` contains the literal text `No data issues detected.` and zero
finding entries.

Scenario AT-3: an **Epic** with an unrecognised size is listed
Given an in-scope historical **Epic** whose normalised `_tshirt_size` is not a
**Recognised t-shirt size** (e.g. `"XXL"`),
When the Run path collects findings,
Then `prepareSimulationData(...).findings` contains exactly one finding with
`code === 'UNRECOGNIZED_SIZE_EPIC'`, `severity === 'ERROR'`, a `locators` entry
`{ kind:'epic', id:<epic key> }`, and an `impact`/`message` noting it was excluded
from **Poisson λ** and the **Bootstrap pool**; and the rendered panel shows that epic
key.

Scenario AT-4: a **Constant work** row with an unrecognised size is listed
Given a **Constant work** row in a target **Quarter** whose `tshirt_size` is
unrecognised,
When the Run path collects findings,
Then `findings` contains exactly one finding with
`code === 'UNRECOGNIZED_SIZE_CONSTANT_WORK'`, `severity === 'WARNING'`, a `row`
locator, and a message noting it contributed `0` PM.

Scenario AT-5: collecting the report never alters the Run (advisory — AC-13/I-1)
Given identical inputs and a fixed PRNG seed,
When the engine result is computed from the values `prepareSimulationData` returns,
Then `runSimulation`'s sorted distributions and stats depend **only** on its declared
arguments (`lambda`, `epicSizingDist`, `kPerGroup`, `groups`, `capacity`,
`iterations`, `fixedEffortPerGroup`) and are byte-identical to the result computed
when no `findings` were read — `runSimulation` takes no `findings` argument and reads
none.

### Public entry point

- UI: user clicks **Run Simulation** (`#run-btn`), the Run completes, and the new
  **Error Report** tab is one click away (`data-tab="error-report"`). Tests reach the
  behavior through the named seams `prepareSimulationData(histQs, targetQs)`,
  `renderErrorReport(findings)`, and the rendered jsdom DOM (`#tab-error-report`, the
  `.tab-btn[data-tab="error-report"]`).

### Expected observable outcomes

- A new tab button + panel in the markup; org remains `.active` after a Run.
- `prepareSimulationData(...).findings` is an array; the existing return fields are
  unchanged in value.
- `renderErrorReport([])` → the empty-state text; `renderErrorReport([finding])` →
  the finding's code-derived section, severity, locator id(s), and message.
- Error behavior: a **fatal** Run (the `epicSizingDist.length === 0` throw) does **not**
  call `renderErrorReport`; no report renders (existing throw message preserved).

### Test harness

> **Test-file naming — REQUIRED.** Every test file begins with `0023-` (the task id /
> plan number). vitest's default discovery (`**/*.test.js`) matches a leading-digit
> filename, so no discovery-config change is needed.

Acceptance tests:
- Location + filename: `tests/acceptance/0023-phase-1-error-report-tab.test.js`
- Command: `npx vitest run tests/acceptance/0023-phase-1-error-report-tab.test.js`

Inner / property tests:
- Location + filename: `tests/acceptance/0023-phase-1-finding-model-property.test.js`
- Command: `npx vitest run tests/acceptance/0023-phase-1-finding-model-property.test.js`

Verification:
- `npm run verify` (lint + ast-grep + dep/secret scans + `vitest run`).
- Clean container / CI: the same `npm run verify` under a hermetic, network-disabled
  fresh checkout with `npm ci` (per `backlog.config.json` `hermetic_verify`).

Parity test: N/A — no external source mirrored (see *Authoritative references*).

Fake-injection wiring: N/A — no external system, no fake adapter, no env-var branch.
(There is therefore nothing to carve out of *Forbidden shortcuts*.)

Determinism harness:
- **Clock:** N/A — diagnostics read no time.
- **Randomness:** the engine's PRNG is seeded by the existing **Run** mechanism;
  diagnostics draw no randomness. The I-1 advisory test pins the engine seed (the same
  way the existing engine tests do) and compares stats for equality.
- **Ordering:** `renderErrorReport` must **explicitly sort** findings (severity, then
  `code`, then first-locator `id`); it must never depend on `Map`/`Set`/object key
  iteration order. The finding-collection loops must likewise emit a deterministic
  order. Tests asserting on rendered order rely on this explicit sort.
- **Concurrency:** N/A — single-threaded.

### Proposed implementation seams

- `prepareSimulationData` — additive `findings` field (codes 1-2 this phase).
- `renderErrorReport(findings)` — the panel renderer + the empty state + sections +
  severity sort + count badge (mechanics built here; full cross-category contract
  verified in Phase 6).
- Tab markup (`.tab-bar` button + `#tab-error-report` panel) and the run-handler
  wiring (call `renderErrorReport`; include the panel in the tab-reset block).

Do NOT lock in: the private detector helper names, the exact DOM structure inside a
finding entry (tests assert on text content / finding-level fields, not on a fixed
element tree), or the badge's markup.

### Behavioral rule

For each in-scope **Epic** whose normalised t-shirt size is not a **Recognised
t-shirt size**, the Error Report carries exactly one `UNRECOGNIZED_SIZE_EPIC` finding
(ERROR) locating that epic; for each target-quarter **Constant work** row with an
unrecognised size, exactly one `UNRECOGNIZED_SIZE_CONSTANT_WORK` finding (WARNING)
locating that row. Collecting and rendering the report never aborts or alters the Run.

### Invariants

- `[contract]` Every finding's `severity` is exactly one of `ERROR`/`WARNING`/`INFO`
  (assert in the finding constructor — cheap, local, always-true). *(I-3)*
- `[contract]` Every item-level finding has `locators.length >= 1`; a run-level
  finding has its single run-level locator. *(I-4)*
- `[test-only]` Collecting diagnostics does not change the engine output: for identical
  inputs and seed, `runSimulation` stats are identical with/without the report. *(I-1)*
- `[test-only]` Completeness + uniqueness for this phase's categories: every in-scope
  epic / constant-work row with an unrecognised size appears in exactly one finding of
  its code; a recognised-size epic/row produces none. *(I-2)*

### Properties / invariants to PBT

| Universally-quantified property (∀ inputs in domain) | Generator domain — valid ranges **and** adversarial edges |
|---|---|
| For any set of in-scope epics, `findings.filter(f=>f.code==='UNRECOGNIZED_SIZE_EPIC')` locates **exactly** the epics whose `normalizeSize(_tshirt_size)` ∉ `{2XS,XS,S,M,L,XL,XL+}`, one finding each, no duplicates. | Epic `_tshirt_size` drawn from: the 7 recognised labels (incl. lowercase / trailing-space variants that normalise to recognised — must NOT flag), plus junk (`"XXL"`, `""`, `"  "`, `"medium"`, unicode, very long strings) — must flag. Epic count 0…N. |
| For any inputs and any fixed seed, the engine stats computed from `prepareSimulationData`'s outputs equal the stats computed when `findings` is discarded (advisory / I-1). | λ ∈ [0, 5], `epicSizingDist` of recognised labels (len 0…50), `kPerGroup` entries 0…50, `iterations` small fixed (e.g. 200), fixed seed. |

### Oracle strategy

**Oracle class:** (a) — cheap oracle. A constructed epic/row has a directly-assertable
expected finding (the exact `code`, the exact locator id). The advisory invariant
(I-1) is checked as a metamorphic equality (engine output ⟂ presence of findings) but
the phase's **core** behavior (detect the finding) has a direct oracle, so no
oracle-free machinery is required (and `oracle_free.enabled` is false in this repo).

### Counterexamples (must NOT pass)

- A `renderErrorReport` that hard-codes the empty-state text only when `findings` is a
  specific test fixture, or that special-cases a known epic key.
- A detector that flags a **recognised** size whose raw form differs only by case or
  trailing space (must normalise via `normalizeSize` first — I-5).
- Production code importing from `tests/`, `__mocks__/`, `fixtures/`, or `fakes/`.
- Rendering findings in `Map`/`Set`/object iteration order instead of an explicit sort.

### Forbidden shortcuts

- Do not special-case any epic/row identity in the detection logic.
- Do not let diagnostics mutate `editedInitiatives`, `parsedEpics`,
  `editedConstantWork`, or any engine input, or change any value `prepareSimulationData`
  returns to the engine (would break I-1). Collection is read-only.
- Do not read the wall clock or an unseeded RNG in any detector; do not rely on
  hash/map iteration order — sort explicitly.
- Do not re-implement the size recognition test independently of `normalizeSize` /
  `T_SHIRT_PARAMS` — the detector must agree with what the engine actually excluded
  (I-5, ADR-0037 single source of truth).

### RED gate

- Acceptance command fails because: there is no `data-tab="error-report"` button /
  `#tab-error-report` panel and no `renderErrorReport` function (ReferenceError /
  missing-element assertions), and `prepareSimulationData(...).findings` is `undefined`.
- Inner/property command fails because: the `UNRECOGNIZED_SIZE_EPIC` property finds no
  `findings` field (the generator-driven assertion throws on `undefined`).
- The failure must be **stable** across `test_immutability.flakiness_reruns` (5) reruns.

### Test immutability rule

After the test commit, the implementation session may NOT edit `tests/**`,
`features/**`, `e2e/**`, or `acceptance/**` unless a separate test-fix phase approves it.

### Definition of done

- [ ] Acceptance tests pass.
- [ ] Inner / property tests pass on every rerun and in randomized order (stable green).
- [ ] Scoped mutation score: **N/A** — the mutation layer is recorded N/A for this repo
  (`toolchain.layers.mutation.status: "n/a"`; single-file multi-`<script>` HTML, see
  ADR-0036). Adequacy is covered by the per-rule **PBT** above plus the manual
  negative-control in review; `mutation.enabled` is `false`, so the loop does not block
  on a score.
- [ ] `npm run verify` passes under a hermetic, network-disabled fresh checkout
  (`npm ci`), with every enabled `correctness_gate` layer green:
  - [ ] Type check (strict): **N/A — vanilla JS, no TypeScript** (ADR; config N/A).
  - [ ] Lint at error level (`eslint --max-warnings 0`) passes.
  - [ ] Static-analysis / SAST (`eslint-plugin-security` via `npm run lint`) — no new
    high-severity findings.
  - [ ] Sanitizer: **N/A — managed language**.
  - [ ] Dependency scan (`npm run scan:deps`) — no new high-severity advisories.
  - [ ] Secret scan (`secretlint`) passes.
  - [ ] Forbidden-pattern `ast-grep` scan passes (no test/fixture imports in production).
- [ ] Clean CI / container verification passes.
- [ ] Command, exit code, and log output recorded as artifacts.

---

## Phase 2: Scope & calibration exclusions (out-of-scope epic, orphan epic, quarter-with-no-epics)

### Acceptance behavior

Scenario AT-1: an out-of-scope **Epic** is reported (INFO)
Given an **Epic** excluded from **Poisson λ** because it has neither an in-scope
**Quarter** tag nor an in-scope **Initiative** link (the `!inScope || !link` site,
~`index.html:2084`) **and** a non-empty `_initiative_key`,
When the Run path collects findings,
Then `findings` contains a finding `code === 'EPIC_OUT_OF_SCOPE'`,
`severity === 'INFO'`, an `epic` locator, and a message stating the reason.

Scenario AT-2: an **orphan epic** is its own distinct category (WARNING)
Given an **Epic** whose `_initiative_key` is blank (empty parent),
When the Run path collects findings,
Then `findings` contains a finding `code === 'ORPHAN_EPIC'`, `severity === 'WARNING'`,
an `epic` locator, and the epic is **not** also reported as `EPIC_OUT_OF_SCOPE`
(distinct categories, no double-count — I-2).

Scenario AT-3: a selected historical **Quarter** with initiatives but zero in-scope
epics is reported (WARNING)
Given a selected **Historical quarter** that has **Initiative**s but no loaded in-scope
**Epic**s — so its initiatives are dropped from the λ denominator (the
`quartersWithEpicData` filter, ~`index.html:2061-2073`),
When the Run path collects findings,
Then `findings` contains a finding `code === 'QUARTER_NO_EPICS'`,
`severity === 'WARNING'`, a `quarter` locator naming the quarter, and an `impact`
stating the **count of its excluded initiatives**.

### Public entry point

- Same as Phase 1: the completed **Run** path; tests target
  `prepareSimulationData(histQs, targetQs).findings` and the rendered `#tab-error-report`.

### Expected observable outcomes

- `findings` gains `EPIC_OUT_OF_SCOPE`, `ORPHAN_EPIC`, `QUARTER_NO_EPICS` entries when
  the corresponding silent exclusions occur; none when they do not.
- The rendered report shows a "Scope & calibration" section listing them.
- Engine output unchanged (I-1 still holds).

### Test harness

Acceptance: `tests/acceptance/0023-phase-2-scope-exclusions.test.js` — command
`npx vitest run tests/acceptance/0023-phase-2-scope-exclusions.test.js`.
Property: `tests/acceptance/0023-phase-2-scope-property.test.js`.
Verification: `npm run verify`. Parity / fake-injection: N/A. Determinism: explicit
sort + seeded engine as Phase 1.

### Proposed implementation seams

- `prepareSimulationData` — additive findings (codes 3-5), collected at the
  in-scope/`!link` epic loop and the `quartersWithEpicData` denominator filter.
- `renderErrorReport` — reused unchanged (sections already keyed by `category`).

Do NOT lock in: detector helper names; the exact wording of messages.

### Behavioral rule

Every **Epic** the engine silently dropped from λ for a scope reason is reported: an
empty-parent epic as `ORPHAN_EPIC` (WARNING), any other out-of-scope epic as
`EPIC_OUT_OF_SCOPE` (INFO); and every selected historical **Quarter** whose
initiatives were dropped from the λ denominator because it carried no in-scope epics is
reported as `QUARTER_NO_EPICS` (WARNING) with its excluded-initiative count. No epic is
counted under more than one of these codes.

### Invariants

- `[contract]` `QUARTER_NO_EPICS.impact` references a non-negative integer count
  (cheap, local). *(I-4)*
- `[test-only]` An epic is reported as **exactly one** of `ORPHAN_EPIC` /
  `EPIC_OUT_OF_SCOPE` / (in-scope ⇒ neither). *(I-2)*
- `[test-only]` Detectors normalise quarter and key strings exactly as the engine does
  (`.trim()`, the detected init-key column) — no false positive on a formatting
  variant the engine actually matched. *(I-5)*

### Properties / invariants to PBT

| Universally-quantified property | Generator domain |
|---|---|
| For any epic set, the union of epics flagged `ORPHAN_EPIC` ∪ `EPIC_OUT_OF_SCOPE` equals exactly the set the engine excluded from λ for a scope reason, partitioned (no epic in both). | Epics with `_initiative_key` ∈ {blank, valid hist key, unknown key}, `_quarter` ∈ {in-window, out-of-window, blank}; hist window 0…N quarters. |
| For any selection, `QUARTER_NO_EPICS` is emitted iff a selected historical quarter has ≥1 initiative and 0 in-scope tagged epics, and its count equals that quarter's initiative count. | Initiatives across quarters with/without matching epics; quarters with 0 initiatives (must NOT flag). |

### Oracle strategy

**Oracle class:** (a) — cheap oracle (constructed exclusions have known expected
findings; counts are hand-verifiable).

### Counterexamples (must NOT pass)

- Reporting an in-scope epic as out-of-scope, or flagging an epic whose quarter the
  engine actually matched (normalisation mismatch — I-5).
- Counting an orphan epic under both `ORPHAN_EPIC` and `EPIC_OUT_OF_SCOPE`.
- A `QUARTER_NO_EPICS` count read from `Set` size in iteration order rather than the
  initiative count.

### Forbidden shortcuts

- Same as Phase 1 (no identity special-casing; read-only collection; no clock/RNG;
  explicit sort; agree with the engine's actual exclusion decisions).

### RED gate

- Acceptance fails because no `EPIC_OUT_OF_SCOPE` / `ORPHAN_EPIC` / `QUARTER_NO_EPICS`
  finding is produced (the assertions find none). Inner/property fails because the
  partition property finds the codes absent. Stable across 5 reruns.

### Test immutability rule

As Phase 1 (`tests/**` etc. frozen after the test commit).

### Definition of done

- [ ] Acceptance + property tests pass (stable green, randomized order).
- [ ] Mutation: N/A (as Phase 1). PBT covers per-rule adequacy.
- [ ] `npm run verify` green under hermetic checkout; all enabled `correctness_gate`
  layers pass (typecheck/sanitizer N/A; lint/SAST/dep/secret/forbidden-pattern pass).
- [ ] Clean CI passes; artifacts recorded.

---

## Phase 3: Run-parameter & degenerate-run findings (λ=0, total K=0, capacity coercion, iterations clamp)

### Acceptance behavior

Scenario AT-1: `λ = 0` is reported (WARNING)
Given a **Run** whose in-scope historical initiatives all had zero sized epics so
**Poisson λ** = 0,
When the Run path collects findings,
Then `findings` contains `code === 'LAMBDA_ZERO'`, `severity === 'WARNING'`, a `run`
locator referencing `λ = 0`.

Scenario AT-2: total **K** = 0 is reported (WARNING)
Given a **Run** where no **Initiative** matches any **Group**'s members so total K = 0,
When the Run path collects findings,
Then `findings` contains `code === 'TOTAL_K_ZERO'`, `severity === 'WARNING'`, a `run`
locator.

Scenario AT-3: capacity coercion is reported entered-vs-used (WARNING)
Given the **Capacity** input is not a finite number `> 0` (so the Run used the `120`
default),
When `collectRunLevelFindings({ enteredCapacity:<bad>, usedCapacity:120, … })` runs,
Then it returns `code === 'CAPACITY_COERCED'`, `severity === 'WARNING'`, with a message
stating the entered value and the used value (`120`).

Scenario AT-4: iterations clamp/default is reported entered-vs-used (WARNING)
Given the **Iterations** input is not an integer within `[1000, 10000000]` (so the Run
clamped/defaulted it),
When `collectRunLevelFindings({ enteredIterations:<bad>, usedIterations:<used>, … })`
runs,
Then it returns `code === 'ITERATIONS_CLAMPED'`, `severity === 'WARNING'`, stating
entered-vs-used; and when the entered value equals the used value, **no** finding.

### Public entry point

- `λ=0` / `total-K=0`: the completed-Run path via `prepareSimulationData(...).findings`
  (derived from the returned `lambda` and `kPerGroup`). Capacity/iterations: the
  named seam `collectRunLevelFindings({...})`, which the run-button handler calls with
  the entered (`#capacity` / `#iterations` raw) and used (post-coerce/clamp) values.

### Expected observable outcomes

- `findings` carries the four run-parameter codes when the conditions hold; none when
  they do not (e.g. capacity entered = used ⇒ no `CAPACITY_COERCED`).
- The report shows a "Run parameters" section.
- These findings are **run-level**: their locator references the run-level value, not
  an item id (I-4).

### Test harness

Acceptance: `tests/acceptance/0023-phase-3-run-parameters.test.js`.
Property: `tests/acceptance/0023-phase-3-coercion-property.test.js`.
Command: `npx vitest run tests/acceptance/0023-phase-3-run-parameters.test.js`.
Verification: `npm run verify`. Parity / fake-injection: N/A. Determinism: the
coercion/clamp mirrors the run handler exactly (`parseFloat(...)||120`;
`Math.min(10000000, Math.max(1000, parseInt(...)||1000000))`); tests pass explicit
entered/used pairs (no RNG, no clock).

### Proposed implementation seams

- `collectRunLevelFindings({ enteredCapacity, usedCapacity, enteredIterations,
  usedIterations })` — new named pure seam (codes 8-9).
- `prepareSimulationData` — additive findings (codes 6-7) from `lambda` / `kPerGroup`.
- Run-button handler — passes entered + used capacity/iterations to
  `collectRunLevelFindings` and concatenates its result before `renderErrorReport`.

Do NOT lock in: the message wording; whether `λ=0`/`K=0` are computed inside
`prepareSimulationData` or a private helper it calls (the test contract is the
`findings` content, not the call site).

### Behavioral rule

When **Poisson λ** = 0 or total **K** = 0, a WARNING finding is emitted. When the
**Capacity** the Run used differs from the entered value (because it was coerced to the
`120` default), a `CAPACITY_COERCED` WARNING states entered-vs-used; likewise an
`ITERATIONS_CLAMPED` WARNING when the iterations value used differs from the entered
value. When entered equals used, no coercion finding is emitted.

### Invariants

- `[contract]` A coercion finding is emitted **iff** `entered !== used` (guard in
  `collectRunLevelFindings` — cheap, local, always-true).
- `[contract]` Run-level findings carry a single `run` locator. *(I-4)*
- `[test-only]` `LAMBDA_ZERO` ⇔ `lambda === 0`; `TOTAL_K_ZERO` ⇔
  `sum(kPerGroup) === 0`. *(I-2)*

### Properties / invariants to PBT

| Universally-quantified property | Generator domain |
|---|---|
| For any raw capacity string, `CAPACITY_COERCED` is present iff `(parseFloat(raw)||120) !== parseFloat(raw)` (i.e. the entered value was not a usable finite `>0` number), and the message names both values. | `raw` ∈ {finite >0 numbers, 0, negative, `""`, `"abc"`, `"NaN"`, `"1e9"`, whitespace}. |
| For any raw iterations string, `ITERATIONS_CLAMPED` is present iff the clamped/defaulted value `!==` the entered integer. | `raw` ∈ {in-range ints, `< 1000`, `> 1e7`, non-integer, `""`, junk}. |

### Oracle strategy

**Oracle class:** (a) — cheap oracle (the coerce/clamp formulas are the reference; the
finding is directly assertable from entered/used).

### Counterexamples (must NOT pass)

- Emitting `CAPACITY_COERCED` when the entered value was already valid and used as-is.
- Reading `#capacity` / `#iterations` a second time inside the collector instead of
  receiving entered/used (must not re-derive — single source of truth, ADR-0037).
- Reporting `LAMBDA_ZERO` when λ is a tiny positive number (must be exact `=== 0`).

### Forbidden shortcuts

- Do not duplicate the coerce/clamp logic with a *different* formula than the run
  handler uses (the finding must reflect what the Run actually used).
- No clock/RNG; explicit sort; read-only.

### RED gate

- Acceptance fails because `collectRunLevelFindings` does not exist (ReferenceError)
  and `findings` carries no `LAMBDA_ZERO`/`TOTAL_K_ZERO`. Property fails on the
  iff-conditions. Stable across 5 reruns.

### Test immutability rule

As Phase 1.

### Definition of done

- [ ] Acceptance + property tests pass (stable green, randomized order).
- [ ] Mutation: N/A (as Phase 1).
- [ ] `npm run verify` green under hermetic checkout; enabled layers pass.
- [ ] Clean CI passes; artifacts recorded.

---

## Phase 4: Duplicates & overlaps (duplicate initiative keys, quarter-label variants, historical∩target overlap)

### Acceptance behavior

Scenario AT-1: duplicate **Initiative key** across rows (WARNING)
Given the same **Initiative key** appears in more than one **Initiatives CSV** row,
When the Run path collects findings,
Then `findings` contains `code === 'DUP_INITIATIVE_KEY'`, `severity === 'WARNING'`, an
`initiative` locator with the key, and an `impact` stating its **row count**.

Scenario AT-2: quarter-label normalisation variants (WARNING)
Given two or more **Quarter** raw strings that collapse to the same normalised value
but appear as distinct raw strings (e.g. `"Q2 2026"` and `" Q2 2026"`),
When the Run path collects findings,
Then `findings` contains `code === 'QUARTER_NORM_VARIANT'`, `severity === 'WARNING'`,
listing the variant raw strings.

Scenario AT-3: historical∩target **Quarter** overlap (WARNING)
Given the same normalised **Quarter** is selected in **both** the historical and the
target window,
When the Run path collects findings,
Then `findings` contains `code === 'HIST_TARGET_OVERLAP'`, `severity === 'WARNING'`,
naming the overlapping quarter(s).

### Public entry point

- The completed-Run path via `prepareSimulationData(histQs, targetQs).findings`.

### Expected observable outcomes

- `findings` carries the three duplicate/overlap codes when present; none otherwise.
- The report shows a "Duplicates & overlaps" section.

### Test harness

Acceptance: `tests/acceptance/0023-phase-4-duplicates-overlaps.test.js`.
Property: `tests/acceptance/0023-phase-4-duplicates-property.test.js`.
Command: `npx vitest run tests/acceptance/0023-phase-4-duplicates-overlaps.test.js`.
Verification: `npm run verify`. Parity / fake-injection: N/A. Determinism: explicit
sort; quarter/key normalisation via the same `.trim()` rules the engine uses (I-5);
no RNG/clock.

### Proposed implementation seams

- `prepareSimulationData` — additive findings (codes 10-12) from the initiatives
  rows and the selected hist/target quarter sets.
- `renderErrorReport` — reused.

Do NOT lock in: detector helper names; the order variants are listed within a finding
(must be deterministic, but the exact comparator is internal).

### Behavioral rule

Each **Initiative key** present in >1 initiatives row yields one `DUP_INITIATIVE_KEY`
(WARNING) with its row count; each cluster of **Quarter** raw strings that normalise to
one value but differ raw yields one `QUARTER_NORM_VARIANT` (WARNING) listing the
variants; each normalised **Quarter** selected in both windows yields one
`HIST_TARGET_OVERLAP` (WARNING). Normalisation matches the engine (`.trim()` / detected
init-key column) so no finding fires on a difference the engine itself collapsed away.

### Invariants

- `[contract]` `DUP_INITIATIVE_KEY.impact` row count is an integer `>= 2`. *(I-4)*
- `[test-only]` A key appearing once produces no `DUP_INITIATIVE_KEY`; a quarter
  appearing with one raw form produces no `QUARTER_NORM_VARIANT`. *(I-2)*
- `[test-only]` `HIST_TARGET_OVERLAP` is symmetric and emitted once per overlapping
  normalised quarter (no double-count). *(I-2, I-5)*

### Properties / invariants to PBT

| Universally-quantified property | Generator domain |
|---|---|
| For any initiatives, the set of keys flagged `DUP_INITIATIVE_KEY` equals exactly the keys whose normalised form occurs ≥2 times, each with the correct count. | Keys with multiplicities 1…M, including case/whitespace variants that normalise equal (must group together). |
| For any hist/target selections, `HIST_TARGET_OVERLAP` lists exactly the quarters in `normalise(hist) ∩ normalise(target)`. | Quarter strings with leading/trailing space, identical-after-trim pairs, disjoint sets, full overlap. |

### Oracle strategy

**Oracle class:** (a) — cheap oracle (multiplicities and set intersection are
directly computable references).

### Counterexamples (must NOT pass)

- Flagging a key that appears once, or splitting one normalised key into two findings
  because of raw-case differences (must group by normalised form — I-5).
- Reporting `HIST_TARGET_OVERLAP` for quarters that only *look* different but normalise
  equal across windows in the wrong direction (must use the same normalisation).

### Forbidden shortcuts

- Do not normalise quarters/keys with a rule different from the engine's `.trim()` /
  detected column (would false-positive or miss — I-5).
- No clock/RNG; explicit sort; read-only.

### RED gate

- Acceptance fails because the three codes are absent. Property fails on the
  multiplicity/intersection equalities. Stable across 5 reruns.

### Test immutability rule

As Phase 1.

### Definition of done

- [ ] Acceptance + property tests pass (stable green, randomized order).
- [ ] Mutation: N/A (as Phase 1).
- [ ] `npm run verify` green under hermetic checkout; enabled layers pass.
- [ ] Clean CI passes; artifacts recorded.

---

## Phase 5: Initiative & cross-reference integrity + constant-work exclusion

### Acceptance behavior

Scenario AT-1: initiatives row missing/blank **Initiative key** (WARNING)
Given an initiatives row whose detected **Initiative key** cell is missing/blank,
Then `findings` contains `code === 'INIT_MISSING_KEY'`, `severity === 'WARNING'`, a
`row` locator.

Scenario AT-2: initiatives row with a bad **Quarter** (WARNING)
Given an initiatives row with a blank **Quarter**, or a quarter in no selected window,
Then `findings` contains `code === 'INIT_BAD_QUARTER'`, `severity === 'WARNING'`, a
`row` (and, where applicable, `quarter`) locator, with a message distinguishing
blank vs not-selected.

Scenario AT-3: initiatives row missing team or **Category** (WARNING)
Given an initiatives row with a blank team or a blank category cell,
Then `findings` contains `code === 'INIT_MISSING_TEAM_OR_CATEGORY'`,
`severity === 'WARNING'`, a `row` locator.

Scenario AT-4: dangling epic link (WARNING)
Given an **Epic** whose `_initiative_key` is non-blank but matches no existing
**Initiative key** (distinct from an orphan empty parent — Phase 2),
Then `findings` contains `code === 'DANGLING_EPIC_LINK'`, `severity === 'WARNING'`, an
`epic` locator and the dangling key, and the epic is **not** also reported as
`ORPHAN_EPIC`.

Scenario AT-5: a selected target **Quarter** with zero matching initiatives (INFO)
Given a selected **Target quarter** that no **Initiative** falls in,
Then `findings` contains `code === 'TARGET_QUARTER_NO_INITIATIVES'`,
`severity === 'INFO'`, a `quarter` locator.

Scenario AT-6: constant work excluded because its **Category** matches no **Group** (WARNING)
Given `getConstantWorkExcluded(...)` reports `pm > 0` / `rows > 0` for the target
quarters,
Then `findings` contains `code === 'CONSTANT_WORK_EXCLUDED'`, `severity === 'WARNING'`,
with an `impact` giving the **excluded PM total** and **row count**.

### Public entry point

- The completed-Run path via `prepareSimulationData(histQs, targetQs).findings`
  (constant-work exclusion uses the existing `getConstantWorkExcluded` output the run
  path already computes).

### Expected observable outcomes

- `findings` carries codes 13-18 when their conditions hold; none otherwise.
- The report shows an "Initiative integrity" section (codes 13-17) and a "Constant
  work" section (code 18).

### Test harness

Acceptance: `tests/acceptance/0023-phase-5-integrity.test.js`.
Property: `tests/acceptance/0023-phase-5-integrity-property.test.js`.
Command: `npx vitest run tests/acceptance/0023-phase-5-integrity.test.js`.
Verification: `npm run verify`. Parity / fake-injection: N/A. Determinism: row indices
are stable (array order of `editedInitiatives` / `editedConstantWork`); explicit sort;
no RNG/clock.

### Proposed implementation seams

- `prepareSimulationData` — additive findings (codes 13-18); `DANGLING_EPIC_LINK`
  uses `histKeys` / the full initiative-key set; `CONSTANT_WORK_EXCLUDED` reads the
  existing `getConstantWorkExcluded(targetQuarters, groupsStore)` result.
- `renderErrorReport` — reused.

Do NOT lock in: detector helper names; whether a `row` locator id is the array index
or the row's key (either is acceptable as long as it concretely references the row).

### Behavioral rule

Each initiatives row with a structural defect (missing key, bad quarter, missing
team/category) yields its own WARNING finding referencing that row; each **Epic** with
a non-blank link to a nonexistent **Initiative key** yields a `DANGLING_EPIC_LINK`
(WARNING, distinct from `ORPHAN_EPIC`); each selected **Target quarter** with no
matching initiative yields a `TARGET_QUARTER_NO_INITIATIVES` (INFO); and constant work
excluded because its **Category** is in no **Group** yields one `CONSTANT_WORK_EXCLUDED`
(WARNING) with the excluded PM total and row count.

### Invariants

- `[contract]` `CONSTANT_WORK_EXCLUDED` is emitted iff `getConstantWorkExcluded(...)`
  returns `rows > 0`; its `impact` PM equals that function's `pm` (single source —
  ADR-0037). *(I-2, I-4)*
- `[contract]` Every row-level finding carries a concrete `row` locator. *(I-4)*
- `[test-only]` `DANGLING_EPIC_LINK` and `ORPHAN_EPIC` are disjoint (non-blank-but-
  unknown vs blank). *(I-2)*

### Properties / invariants to PBT

| Universally-quantified property | Generator domain |
|---|---|
| For any epic set, an epic is flagged `DANGLING_EPIC_LINK` iff its `_initiative_key` is non-blank and ∉ the initiative-key set, and `ORPHAN_EPIC` iff blank — never both, never neither-when-it-should. | `_initiative_key` ∈ {blank, valid key, unknown non-blank key}; initiative key set 0…N. |
| For any constant-work rows, `CONSTANT_WORK_EXCLUDED.impact` PM/rows equal `getConstantWorkExcluded`'s `pm`/`rows` for the target quarters. | CW rows with categories in/out of Group members, recognised/unrecognised sizes, in/out target quarters. |

### Oracle strategy

**Oracle class:** (a) — cheap oracle (each defect is constructed with a known expected
finding; the constant-work totals are taken from the engine's own helper).

### Counterexamples (must NOT pass)

- Reporting a dangling link as an orphan (or vice-versa).
- Re-summing constant-work PM with a formula different from `getConstantWorkExcluded`
  (must reuse it — single source of truth).
- Flagging a target quarter that *does* contain an initiative (normalisation mismatch).

### Forbidden shortcuts

- Do not re-implement constant-work exclusion independently of
  `getConstantWorkExcluded`.
- No identity special-casing; no clock/RNG; explicit sort; read-only.

### RED gate

- Acceptance fails because codes 13-18 are absent. Property fails on the
  dangling-vs-orphan partition and the PM-equality. Stable across 5 reruns.

### Test immutability rule

As Phase 1.

### Definition of done

- [ ] Acceptance + property tests pass (stable green, randomized order).
- [ ] Mutation: N/A (as Phase 1).
- [ ] `npm run verify` green under hermetic checkout; enabled layers pass.
- [ ] Clean CI passes; artifacts recorded.

---

## Phase 6: Multi-quarter initiatives section + full presentation contract

### Acceptance behavior

Scenario AT-1: forward double-count (ERROR — DC-5)
Given an **Initiative key** appearing in more than one selected **Target quarter** row
(so each row is counted as an independent unit in **K** and draws its own
**Poisson(λ)**),
When the Run path collects findings,
Then `findings` contains `code === 'MQ_FORWARD_DOUBLE_COUNT'`, `severity === 'ERROR'`,
with the initiative key + name, the list of target quarters, the row count, the
group(s)/category it lands in, and a quantified impact line (e.g. "appears in 2 target
quarters → counted as 2 independent initiatives, ~2× effort"). The engine math is
**unchanged** (no engine value differs because of this finding).

Scenario AT-2: partial historical-window exclusion (WARNING)
Given a historical **Initiative** whose **Epic**s span multiple **Quarter**s where some
fall outside the selected historical window (those out-of-window epics are silently
dropped at the in-scope check),
Then `findings` contains `code === 'MQ_PARTIAL_WINDOW_EXCLUSION'`,
`severity === 'WARNING'`, with per-quarter epic counts, which quarters are in vs out of
window, and the count of excluded epics.

Scenario AT-3: multi-quarter historical initiative (INFO)
Given a historical **Initiative** whose in-window **Epic**s carry more than one
distinct **Quarter**,
Then `findings` contains `code === 'MQ_MULTI_QUARTER_HISTORICAL'`,
`severity === 'INFO'`, with epic count per quarter and total epics.

Scenario AT-4: initiative/epic quarter mismatch (WARNING)
Given an **Initiative**'s declared (initiatives-CSV row) **Quarter** does not match the
quarter(s) of its linked **Epic**s,
Then `findings` contains `code === 'MQ_INIT_EPIC_QUARTER_MISMATCH'`,
`severity === 'WARNING'`, with the declared quarter vs the set of epic quarters + counts.

Scenario AT-5: full presentation contract (AC-12)
Given a **Run** that produces findings across **multiple categories and severities**,
When `renderErrorReport(findings)` paints the panel,
Then findings are grouped into labelled sections by category; sections **and** findings
within each section are ordered `ERROR` → `WARNING` → `INFO`; each finding displays its
offending identifier(s) and a quantified impact where applicable; and a by-severity
count summary (badge) shows the ERROR/WARNING/INFO totals.

### Public entry point

- The completed-Run path via `prepareSimulationData(histQs, targetQs).findings` (codes
  19-22, computed with the same `.trim()` / detected init-key-column normalisation the
  engine uses — I-5), and `renderErrorReport(findings)` for AT-5.

### Expected observable outcomes

- A "Multi-quarter initiatives" section listing codes 19-22; `MQ_FORWARD_DOUBLE_COUNT`
  at ERROR while the engine output is byte-identical to a Run without diagnostics (I-1).
- The whole report obeys the DC-3 sort and shows the count badge.

### Test harness

Acceptance: `tests/acceptance/0023-phase-6-multi-quarter.test.js` and
`tests/acceptance/0023-phase-6-presentation.test.js`.
Property: `tests/acceptance/0023-phase-6-multi-quarter-property.test.js`.
Command: `npx vitest run tests/acceptance/0023-phase-6-multi-quarter.test.js`.
Verification: `npm run verify`. Parity / fake-injection: N/A. Determinism: explicit
sort is the property under test in AT-5; quarter/key normalisation matches the engine
(I-5); the I-1 engine-equality test pins the seed; no RNG/clock in detectors.

### Proposed implementation seams

- `prepareSimulationData` — additive findings (codes 19-22) from the per-initiative
  epic-quarter groupings and the target-quarter row groupings it already has.
- `renderErrorReport` — the section grouping, severity sort, and count badge built in
  Phase 1 are now exercised across all categories; this phase verifies (and, if any
  gap remains, completes) the full DC-3 ordering + badge.

Do NOT lock in: the badge markup; the per-finding DOM; the exact impact-string wording.

### Behavioral rule

For the four multi-quarter conditions, emit the corresponding finding at its mandated
severity (`MQ_FORWARD_DOUBLE_COUNT` = ERROR per DC-5, reported but **not fixed**;
`MQ_PARTIAL_WINDOW_EXCLUSION` / `MQ_INIT_EPIC_QUARTER_MISMATCH` = WARNING;
`MQ_MULTI_QUARTER_HISTORICAL` = INFO). The rendered report groups all findings into
labelled per-category sections, orders sections and findings `ERROR` → `WARNING` →
`INFO` with a deterministic secondary key, displays each finding's identifiers + impact,
and shows a by-severity count badge.

### Invariants

- `[contract]` The rendered count badge totals equal `findings.length` partitioned by
  severity (cheap, local).
- `[contract]` `MQ_FORWARD_DOUBLE_COUNT.severity === 'ERROR'` (DC-5).
- `[test-only]` Rendered section/finding order is exactly `ERROR`→`WARNING`→`INFO` then
  the stable secondary key, for any finding multiset. *(DC-3)*
- `[test-only]` Engine output is identical with and without the report (I-1) — re-checked
  here because `MQ_FORWARD_DOUBLE_COUNT` is the most likely place to be tempted into
  "fixing" the math.

### Properties / invariants to PBT

| Universally-quantified property | Generator domain |
|---|---|
| For any multiset of findings, `renderErrorReport` emits them in `ERROR`→`WARNING`→`INFO` order (then by `code`, then first-locator id), grouped by category, and the badge counts match. | Findings with random codes/severities/categories, sizes 0…50, duplicate severities, all-one-severity, empty. |
| For any target-quarter rows, `MQ_FORWARD_DOUBLE_COUNT` flags exactly the initiative keys whose normalised key appears in ≥2 distinct selected target quarters, and the engine's `kPerGroup` is unchanged by the presence of the finding (I-1). | Initiative keys across 1…N target quarters (incl. whitespace/case variants that normalise equal), with linked groups/categories. |

### Oracle strategy

**Oracle class:** (a) — cheap oracle. The multi-quarter conditions and the sort order
are directly computable references; the I-1 engine-equality is a metamorphic check
layered on top, but the core detection + ordering have direct oracles.

### Counterexamples (must NOT pass)

- "Fixing" the double-count by de-duplicating target rows so `kPerGroup` changes
  (forbidden — DC-5 / I-1: report only).
- Sorting by insertion / `Map` order instead of severity.
- Flagging `MQ_FORWARD_DOUBLE_COUNT` for a key whose two raw quarter strings normalise
  to the **same** quarter (that is a duplicate row in one quarter, not a multi-quarter
  span — I-5).

### Forbidden shortcuts

- Do not alter `kPerGroup`, `targetInits`, or any engine value to "correct" the
  double-count.
- Do not rely on hash/map iteration order for the rendered sequence (explicit sort).
- No identity special-casing; no clock/RNG; read-only collection.

### RED gate

- Acceptance fails because codes 19-22 are absent and the rendered output is not
  severity-sorted / has no badge. Property fails on the ordering and the
  `kPerGroup`-unchanged equality. Stable across 5 reruns.

### Test immutability rule

As Phase 1.

### Definition of done

- [ ] Acceptance + property tests pass (stable green, randomized order).
- [ ] Mutation: N/A (as Phase 1).
- [ ] `npm run verify` green under hermetic checkout; enabled `correctness_gate` layers
  pass (typecheck/sanitizer N/A; lint/SAST/dep/secret/forbidden-pattern green).
- [ ] Clean CI passes; artifacts recorded.
- [ ] The whole 22-code report renders correctly on a multi-category Run, org remains
  the resting tab, and the engine output is identical with/without diagnostics (I-1).
