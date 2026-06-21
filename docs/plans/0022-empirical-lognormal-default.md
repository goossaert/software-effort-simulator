# Feature: Default to empirical lognormal parameters on page-load

Created at: 2026-06-21T15:50:53Z

## Context

This feature belongs to the simulator's **Lognormal Parameters** subsystem — the two
parallel per-**T-shirt size** parameter tables and the ephemeral `param-mode` radio that
swaps the module-scoped `activeParams` reference. See `CONTEXT.md` glossary entries
**Synthetic parameters**, **Empirical parameters**, and **Recognised t-shirt size** (all
edited by apply-docs to reflect the reversed default).

Constraining ADRs (look these up; do not re-narrate them here):

- **ADR-0035** (`docs/adr/0035-default-to-empirical-lognormal-parameters.md`) — the
  decision this feature *implements*: on page-load the `empirical` radio is `checked`, its
  label carries `.active`, and `activeParams` initialises to `T_SHIRT_PARAMS_EMPIRICAL`.
  Synthetic stays a one-click alternative. **This is the task's one-way door** (it reverses
  ADR-0026's synthetic default); it is already decided — do not re-open it.
- **ADR-0026** (`docs/adr/0026-…md`) — superseded **in part**: the page-load default moved
  to empirical, but its ephemeral-toggle / no-persistence decision (no `localStorage`, no
  URL param) **still stands** and constrains this feature.
- **ADR-0007** (`docs/adr/0007-…md`) — the synthetic-fit hand-recompute contract; untouched.
  The sidebar **T-shirt size reference** panel stays band-as-definition (out of scope).
- **ADR-0002** (`docs/adr/0002-client-side-only.md`) — "no implicit state across sessions";
  the reason the toggle must remain ephemeral.

### Decision constraints (`DC-n`) and one-way-door ADRs

No `DC-n` were carried in the grill handover. The **single one-way door — the page-load
default selection — is captured by ADR-0035** (grill Plan logistics: "so no separate `DC-n`
is needed"). The `## Data models` / entry-point / idempotency sections below **formalise**
ADR-0035 (default = empirical) and ADR-0026's surviving ephemerality decision; they do not
re-decide either.

## Authoritative references

**N/A — no external behavior mirrored.** The empirical constants (`T_SHIRT_PARAMS_EMPIRICAL`)
are an in-repo calibration governed by ADR-0026, not an external protocol/API/spec. The
default-selection decision is internal (ADR-0035). There is no external source to pin, so no
parity test is required.

## User-visible behavior

On page-load, with **no user interaction**, the simulator defaults to the **Empirical
parameters** lognormal table instead of synthetic:

- The **Empirical lognormal parameters** radio is selected and its label is highlighted; the
  **Synthetic** radio is not.
- Every effort sample drawn by a subsequent **Run** uses the empirical `(μ, σ)` table (the
  operator's intended baseline) without any clicking.
- **Synthetic** remains one click away and behaves exactly as before (the toggle still swaps
  both directions), and the selection is still **ephemeral** — a page reload resets to
  **Empirical**, nothing is persisted.

## Scope

### In scope

- Flipping the page-load default of the `param-mode` radio group from `synthetic` to
  `empirical` (the `checked` attribute and the `.active` label highlight).
- Initialising the module-scoped `activeParams` reference to `T_SHIRT_PARAMS_EMPIRICAL`.
- Updating the stale `// … default: synthetic` source comment next to the initializer.
- Acceptance + property tests proving the new default, and a regression guard that the
  existing bidirectional toggle is unbroken.

### Out of scope

- Introducing **any** persistence (`localStorage` / `sessionStorage` / URL param). ADR-0026's
  ephemerality stands.
- Recalibrating / editing / reordering the `T_SHIRT_PARAMS_EMPIRICAL` or `T_SHIRT_PARAMS`
  constants (a future, separate task).
- Any change to the synthetic table or the sidebar **T-shirt size reference** panel.
- Any change to the `param-mode` `change` handler's swap logic beyond leaving it intact.
- Stamping the active mode onto the **Run** output (ADR-0026 lists this as a future revision).

## Relevant existing files

Claude may inspect:

- `index.html` — the only production file. Verified change sites (re-grep before editing;
  the edits are all **in-place**, so line numbers do not shift):
  - `index.html:952` `<label id="param-label-synthetic" class="active">` → remove `class="active"`.
  - `index.html:953` `<input type="radio" name="param-mode" value="synthetic" checked>` → remove `checked`.
  - `index.html:956` `<label id="param-label-empirical">` → add `class="active"`.
  - `index.html:957` `<input type="radio" name="param-mode" value="empirical">` → add `checked`.
  - `index.html:1332` comment `// … default: synthetic` → `… default: empirical`.
  - `index.html:1333` `let activeParams = T_SHIRT_PARAMS;` → `let activeParams = T_SHIRT_PARAMS_EMPIRICAL;`.
  - `index.html:4524-4530` the `change` handler — **unchanged** (already swaps both ways).
  - `index.html:1322-1330` `T_SHIRT_PARAMS_EMPIRICAL` declaration (read-only context).
- `tests/harness.js` — JSDOM loader (`loadSimulator`, `read`, `evalIn`, `execIn`, `csv`).
- `tests/verification/0003-sanity-check-engine-mean.test.js` — already sets
  `activeParams = T_SHIRT_PARAMS_EMPIRICAL` explicitly (line ~215); **unaffected** by the
  default flip. No existing test asserts synthetic-on-load, so the flip regresses nothing.

Claude should not inspect unless needed: the rest of the 4.6k-line `index.html` engine.

## Existing patterns to follow

- **Acceptance tests** live in: `tests/acceptance/`.
- **Inner / unit tests** live in: `tests/acceptance/` and `tests/verification/` (this repo
  has no separate `tests/unit/`; inner property/example tests sit alongside acceptance
  tests). Use `tests/acceptance/` for this feature's tests.
- **Loading pattern**: tests call `loadSimulator()` (from `tests/harness.js`) to execute all
  of `index.html`'s inline scripts in a JSDOM realm — this *is* a "page-load with no user
  interaction". Read lexical bindings with `read(win, 'activeParams')` /
  `read(win, 'T_SHIRT_PARAMS_EMPIRICAL')`; query DOM with `win.document.querySelector(...)`;
  fire UI events with `el.dispatchEvent(new win.Event('change'))`.
- **No fake/fixture adapter pattern** is used (single static HTML, no external systems).
- **Verification command**: `npm run verify` (post-toolchain composite:
  `lint → scan:forbidden (ast-grep) → scan:deps (npm-audit wrapper) → secretlint → vitest run`).

> **Ubiquitous-language rule:** entity/field/behavior names below match `CONTEXT.md` verbatim
> — **Synthetic parameters** (`T_SHIRT_PARAMS`), **Empirical parameters**
> (`T_SHIRT_PARAMS_EMPIRICAL`), **Recognised t-shirt size**, `activeParams`, `param-mode`.

## Data models

**N/A — no persistence layer.** This feature deliberately introduces **no** stored state:
per ADR-0026 (ephemerality) and ADR-0002 (no implicit cross-session state), the default comes
only from the static HTML `checked` attribute and the `let activeParams = …` initializer, and
resets on every reload. The only "data" are the two pre-existing module-scoped constant tables
(`T_SHIRT_PARAMS`, `T_SHIRT_PARAMS_EMPIRICAL`), which share an identical key set
(`Object.keys` equal — the **Recognised t-shirt size** set: `2XS, XS, S, M, L, XL, XL+`) and
are **not** modified by this feature. Formalising the one-way door: the page-load value of
`activeParams` **is** `T_SHIRT_PARAMS_EMPIRICAL` (ADR-0035), and no key/identifier/idempotency
contract changes (ADR-0026's ephemerality is preserved).

---

## Phase 1: Page-load default flips to the Empirical parameters table (ephemeral, toggle intact)

### Acceptance behavior

Each scenario is observable from outside the system (DOM state, the binding every sampler
reads, and the absence of persisted state) — not from reading the diff.

Scenario AT-1: Page-load selects the Empirical radio (UI)
Given a fresh page-load of `index.html` with **no user interaction**
When the page's scripts have run
Then the `empirical` radio (`input[name="param-mode"][value="empirical"]`) is `checked`
  and `#param-label-empirical` carries the `.active` class,
And the `synthetic` radio is **not** `checked` and `#param-label-synthetic` does **not**
  carry `.active`.

Scenario AT-2: Page-load binds activeParams to the Empirical table
Given a fresh page-load with no user interaction
When the page's scripts have run
Then `activeParams === T_SHIRT_PARAMS_EMPIRICAL` (reference identity), so every sampler
  (`sampleLognormal`, `tshirtToPersonMonths`) reads the empirical table without any user action.

Scenario AT-3: The bidirectional toggle is preserved (regression guard)
Given a freshly loaded page (defaulting to empirical)
When the `synthetic` radio is selected and a `change` event fires
Then `activeParams === T_SHIRT_PARAMS` and `.active` moves to `#param-label-synthetic`
  (off `#param-label-empirical`);
When the `empirical` radio is re-selected and a `change` event fires
Then `activeParams === T_SHIRT_PARAMS_EMPIRICAL` and `.active` moves back to
  `#param-label-empirical`.

Scenario AT-4: The default is ephemeral (no persistence introduced)
Given one loaded window in which the `synthetic` radio was just selected
When a **new** page-load is performed (a fresh `loadSimulator()` window)
Then the new window again defaults to empirical (AT-1/AT-2 hold),
And selecting either radio writes **nothing** to `localStorage` (storage stays empty; no
  `param-mode`/preference key is created).

### Public entry point

UI / page-load: opening `index.html` (no interaction) sets the default; the
`input[name="param-mode"]` radio group + its `change` handler (`index.html:4524-4530`) is the
toggle entry point. In tests the entry point is `loadSimulator()` (a page-load) plus
`dispatchEvent(new Event('change'))` on a radio.

### Expected observable outcomes

- DOM on load: `empirical` radio `checked`; `#param-label-empirical.active`; synthetic radio
  unchecked; `#param-label-synthetic` without `.active`.
- Binding on load: `activeParams === T_SHIRT_PARAMS_EMPIRICAL`.
- After a `change` to synthetic then back: binding + `.active` follow the selection both ways.
- Storage: `window.localStorage` remains empty across toggles; a reload resets to empirical.
- No error behavior path (no invalid input — page-load is parameterless).
- Idempotency: every fresh load yields the identical default (empirical); no order/race
  dependence.

### Test harness

> **Test-file naming — REQUIRED.** Every test file for this feature **begins with `0022-`**
> (the plan/task number), then a behavior slug and the `.test.js` marker Vitest discovers.

Acceptance tests:
- Location + filename: `tests/acceptance/0022-empirical-default-on-load.test.js`
- Command: `npx vitest run tests/acceptance/0022-empirical-default-on-load.test.js`

Inner tests (property + focused examples — same feature prefix, alongside acceptance):
- Location + filename: `tests/acceptance/0022-empirical-default-params-property.test.js`
- Command: `npx vitest run tests/acceptance/0022-empirical-default-params-property.test.js`
- PBT framework: **fast-check** (`pbt.framework`); invoke via `test.prop` / `it.prop` /
  `fc.property` (`pbt.import_symbol`) — already installed (fast-check 4.8.0 +
  @fast-check/vitest 0.3.0).

Verification:
- `npm run verify` (the full composite above), run under the hermetic verify (fresh
  network-disabled checkout, deps from the lockfile via `npm ci`).
- Clean CI/container command: `npm ci && npm run verify`.

Parity test: **N/A** — no external source mirrored (see *Authoritative references*).

Fake-injection wiring: **N/A** — this feature has no external system/adapter, so there is no
fake to inject and nothing to carve out of *Forbidden shortcuts*.

Determinism harness: **N/A** — this phase's assertions are over DOM state and reference/by-value
identity of parameter tables, which are deterministic. No assertion depends on time, the RNG,
collection ordering, or concurrency (the samplers' randomness is **not** exercised here; only
*which table is active* is asserted). `loadSimulator()` is fully deterministic across reruns.

### Proposed implementation seams

Stable seams the tests may target:

- **DOM**: `input[name="param-mode"]` radios and their wrapper `<label>` elements
  (`#param-label-synthetic`, `#param-label-empirical`) and the `.active` class.
- **Module bindings**: `activeParams`, and the constants `T_SHIRT_PARAMS` /
  `T_SHIRT_PARAMS_EMPIRICAL` (read via `read(win, …)`).
- **Samplers** read through `activeParams` (assert *which table* they resolve to, not their
  internal algorithm).

Do NOT lock in: the change handler's private structure, sampler internals, or any incidental
helper names.

### Behavioral rule

On every page-load with no interaction, the simulator's active lognormal parameter set is the
**Empirical parameters** table, and the **Empirical** radio is the selected/highlighted option
— the UI selection and `activeParams` are mutually consistent. Selecting **Synthetic** swaps
both back (and vice-versa); the selection is never persisted across reloads.

### Invariants

- **`[test-only]` I-1** — On page-load the radio's `checked` option and the initial value of
  `activeParams` are **consistent**: empirical-checked ⇔ `activeParams === T_SHIRT_PARAMS_EMPIRICAL`
  (never a state where the UI shows one mode but the binding holds the other). This is a
  **cross-surface** invariant spanning the static HTML and the JS initializer — no single
  function can check it in O(1), so it is **not** a runtime contract; it is enforced jointly by
  AT-1 + AT-2 (and the property below). Covered both directions by AT-3.
- **`[test-only]` I-2** — The toggle introduces **no** persisted state (`localStorage` empty
  across toggles; reload resets to empirical). A whole-window/storage property, not a local
  function pre/postcondition. Covered by AT-4.

**No `[contract]` invariants for this phase.** A UI-default flip plus a module-scoped reference
initializer has no cheap, local, always-true precondition/postcondition a single production
function holds (the consistency is HTML↔JS cross-surface). `contract.enabled` is `false` in
config, so gate sub-check (g) does not run; this is the honest classification, not an omission.

### Properties / invariants to PBT

| Universally-quantified property (∀ inputs in domain) | Generator domain — valid ranges **and** adversarial edges |
|---|---|
| For **every** Recognised t-shirt size `s`, on a fresh page-load (no interaction) the active parameters for `s` equal the Empirical table's entry for `s` by value: `activeParams[s].mu === T_SHIRT_PARAMS_EMPIRICAL[s].mu` **and** `activeParams[s].sigma === T_SHIRT_PARAMS_EMPIRICAL[s].sigma`. (Formalises AC-2 / I-1: every sampler reads empirical for every size, with no user action.) | `s` drawn from the Recognised t-shirt size set = `Object.keys(T_SHIRT_PARAMS_EMPIRICAL)` (`2XS, XS, S, M, L, XL, XL+`), e.g. `fc.constantFrom(...keys)`. **Adversarial edges:** the carry-through sizes `2XS / XL / XL+` (empirical `(μ,σ)` equals synthetic *by value*, so the property must still hold there) — and crucially the property is **not** vacuously satisfiable by a synthetic default, because the calibrated sizes `XS / S / M / L` have a different empirical `μ`, so a synthetic-on-load init fails the property on those sizes. |

Generator note for atdd: read the key set and both tables from the loaded window
(`read(win, 'T_SHIRT_PARAMS_EMPIRICAL')`), generate a size from those keys, and assert against
`read(win, 'activeParams')[s]`. Do **not** hand-list the sizes in the test (read them from the
page) so the property tracks the table, not a fixture copy.

### Oracle strategy

**Oracle class:** (a)

Cheap oracle — the correct output is directly assertable: the Empirical table is a known
in-repo reference, and `radio.checked` / `classList.contains('active')` / `localStorage.length`
are directly observable. The triangulation examples (AT-1..AT-4) and the PBT property assert it
outright; no metamorphic relation or differential check is needed (and `oracle_free.enabled` is
`false`).

### Counterexamples (must NOT pass)

- A test/JSDOM-only branch that flips the default to empirical **only** under the harness
  (e.g. keyed on a global the test sets, or `NODE_ENV`/`TEST`) while the real page still
  defaults to synthetic.
- Initialising `activeParams` to a value that merely *equals* empirical for the carry-through
  sizes but is in fact the synthetic table — caught by the property on `XS / S / M / L`.
- Adding `localStorage`/`sessionStorage`/URL persistence to "remember" empirical (violates
  AT-4, ADR-0026, ADR-0002).
- Achieving the default by **mutating** `T_SHIRT_PARAMS_EMPIRICAL` (or `T_SHIRT_PARAMS`) values
  instead of by selecting the empirical table (out of scope, and would falsify the property's
  by-value reads against the table itself).
- Any production code importing from `tests/`, `__mocks__/`, `fixtures/`, or `fakes/`.

### Forbidden shortcuts

- Do **not** introduce any persistence layer (`localStorage` / `sessionStorage` / URL /
  in-memory cross-session) to produce the default. The default must come **only** from the
  static HTML `checked` attribute + the `let activeParams = T_SHIRT_PARAMS_EMPIRICAL`
  initializer, and reset on every reload.
- Do **not** special-case the test/JSDOM environment, user identity, or any env flag to flip
  the default (no `NODE_ENV === 'test'` / `process.env.TEST` / global-keyed branch).
- Do **not** edit, recalibrate, or reorder `T_SHIRT_PARAMS_EMPIRICAL`, `T_SHIRT_PARAMS`, or the
  sidebar T-shirt size reference panel.
- Do **not** alter the `change` handler's swap logic beyond leaving it intact (AT-3 must pass
  through the real, unmodified handler).
- No fake-injection wiring exists in this phase, so there is nothing to carve out here.

### RED gate

Before implementation starts, on the **unmodified** base (synthetic default):

- Acceptance command (`npx vitest run tests/acceptance/0022-empirical-default-on-load.test.js`)
  must **fail** because: AT-1 fails (`empirical` radio not `checked`; `#param-label-synthetic`
  still `.active`) and AT-2 fails (`activeParams === T_SHIRT_PARAMS`, not the empirical table).
  AT-4's "fresh load defaults to empirical" also fails for the same reason.
- Inner/property command
  (`npx vitest run tests/acceptance/0022-empirical-default-params-property.test.js`) must
  **fail** because: for the calibrated sizes (`XS / S / M / L`) `activeParams[s].mu` equals the
  **synthetic** `μ`, not the empirical `μ`, so the property's shrinker reports a minimal
  failing size.
- Note for atdd: AT-3 (toggle) and AT-4's "no `localStorage` write" assertions are **already
  green on the base** (the toggle works; nothing is persisted today) — they are regression
  guards, not RED drivers. Each test **file/command** is still RED overall because its
  new-default assertions (AT-1/AT-2/AT-4-default and the property) fail; ensure those
  RED-driving assertions live in the committed RED files.
- The failure must be **stable** across `test_immutability.flakiness_reruns` (5) — it is
  deterministic (DOM + reference/by-value identity, no RNG in the assertions).

### Test immutability rule

After the test commit, the implementation session may NOT edit `tests/**`, `features/**`,
`e2e/**`, or `acceptance/**` unless explicitly approved in a separate test-fix phase.

### Definition of done

- [ ] Acceptance tests (AT-1..AT-4) pass.
- [ ] Property test (per-size empirical-on-load) and focused examples pass **on every rerun and
  in randomized order** (`npm run verify -- --sequence.shuffle`) — stable green.
- [ ] **Scoped mutation score ≥ 70%** on the param-mode region. Mutation is **scoped** (per the
  apply-docs handover: whole-file 80 is unrealistic day one) to the changed initializer + the
  param-mode `change` handler via Stryker line-ranges **`["index.html:1333", "index.html:4522-4531"]`**
  (set in `stryker.conf.json` by this plan; `backlog.config.json` `mutation.min_score` set to
  `70`). The empirical/synthetic **data tables are deliberately excluded** from `mutate`: their
  numeric-literal mutants are not killable by this phase's tests (the property reads `μ/σ` from
  the same table on both sides) and would only dilute the score. Rationale: the changed
  initializer line yields ~no operator/literal mutants, so the scored mutants come from the
  `change` handler (string/equality/conditional/ternary), which AT-1 + AT-3 exercise directly;
  70% leaves headroom for a few equivalent or inline-script-boundary mutants on a single-file
  HTML app while still pinning the toggle logic. Surviving non-equivalent mutants are
  missing-test gaps → closed by re-running `/stage-atdd`, never by editing tests during review.
  **Implement must re-grep the two ranges before committing** (edits are in-place so lines
  should not drift, but confirm) and adjust `stryker.conf.json` if they did.
- [ ] `npm run verify` passes **under a hermetic verify** (fresh, network-disabled checkout of
  the commit; deps from the lockfile via `npm ci`), running the **full** `correctness_gate`
  stack with no layer disabled/downgraded/scope-narrowed:
  - [ ] Type check (strict) — **N/A** (vanilla JS, no TypeScript; `correctness_gate.typecheck_command` empty).
  - [ ] Linter at error level — `npm run lint` (ESLint 9 + `eslint-plugin-security`, `--max-warnings 0`).
  - [ ] Static-analysis / SAST — `npm run lint` (eslint-plugin-security recommended; only
    `detect-object-injection` disabled, the canonical FP on param-table lookups).
  - [ ] Sanitizer — **N/A** (managed/interpreted language).
  - [ ] Dependency-vulnerability scan — `npm run scan:deps` (npm audit wrapped by
    `scripts/dep-scan.mjs`; the two pre-existing dev-server-only advisories are the documented
    accepted exception — every other high/critical still fails).
  - [ ] Secret scan — `npx secretlint "**/*"`.
  - [ ] Forbidden-pattern scan — `npm run scan:forbidden` (ast-grep).
- [ ] Clean CI/container verification passes (`npm ci && npm run verify`).
- [ ] Command, exit code, and log output recorded as artifacts under `docs/atdd-logs/`.

---

## Phase 2 (if applicable)

**N/A — single-phase feature.** `total_phases = 1`. The page-load default flip is one thin
vertical slice with one observable outcome (the default mode), whose facets (UI selection,
the `activeParams` binding they control, ephemerality, and the preserved toggle) are coupled
by invariant I-1 and cannot be cut into independently-acceptance-testable sub-phases without
producing scaffolding-only slices.
