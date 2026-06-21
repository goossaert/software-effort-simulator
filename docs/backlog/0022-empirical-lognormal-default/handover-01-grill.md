---
schema: backlog-handover/v1
task_id: "0022"
produced_by_phase: grill
feature_phase: null
for_next_phase: apply-docs
outcome: success
reason: ""
produced_at: 2026-06-20T21:36:48Z
produced_commit: 2f245a5a9c1d99d697f13fa88cdd40c20d3af046
---

## Summary

Grill birthed task 0022: make the **Empirical parameters** lognormal table the page-load default
instead of **Synthetic parameters**. The mechanism is small and fully understood (three coupled
sites in `index.html`), but it reverses the page-load default that ADR-0026 deliberately chose, so
a superseding **ADR-0035** and two `CONTEXT.md` glossary corrections are prepared below. Because
this is the first task born under the v3 toolchain, this handover also carries the **`## Mechanical
toolchain to apply`** section — a human-selected, web-searched (2026-06-20) test toolchain that
`apply-docs` must install/apply, flipping `toolchain.selected: true`.

## Instructions for the next phase (apply-docs)

1. **Apply the `## CONTEXT.md edits to apply`** — three surgical find/replace edits in `CONTEXT.md`.
   Locate by the quoted text (line numbers may have drifted; grep the quoted phrase).
2. **Create the ADR** in `## ADRs to create`: write `docs/adr/0035-default-to-empirical-lognormal-parameters.md`
   verbatim, and add the one-line superseded-in-part note to `docs/adr/0026-...md`.
3. **Apply the `## Mechanical toolchain to apply`** section: run each `selected` layer's `install`,
   perform the **Wiring** steps (verify-script, eslint config, tool config files), set every `config:`
   key with `jq`, verify each tool actually runs, then set `toolchain.selected: true` **last**. A
   failed/unrunnable install or tool-probe is a `blocked` outcome — never advance with a tool missing.
4. Do **not** touch `index.html` — the production change is the `plan`→`atdd`→`implement` job, scoped
   in `## Plan logistics`.

## CONTEXT.md edits to apply

All three are in the glossary entries for **Synthetic parameters** (around line 36) and **Empirical
parameters** (around line 40). Do not alter the stale `index.html:NNNN` references in those entries —
they predate this task and are out of scope.

**Edit 1 — Synthetic entry, opening clause (it is no longer "the default"):**
- FIND: `The default lognormal parameter set, fit to the documented P10/P90 of each **T-shirt size** band`
- REPLACE: `The documented-baseline lognormal parameter set, fit to the documented P10/P90 of each **T-shirt size** band`

**Edit 2 — Synthetic entry, final sentence (drop the "default value of activeParams" claim):**
- FIND: `The default value of `activeParams` (`index.html:1264`) on every page-load.`
- REPLACE: `No longer the page-load default as of [ADR-0035](docs/adr/0035-default-to-empirical-lognormal-parameters.md) — now the one-click alternative to the **Empirical parameters**, selectable via the **Lognormal Parameters** radio (`<input name="param-mode" value="synthetic">`).`

**Edit 3 — Empirical entry, the "Swapping is global, ephemeral …" clause (it is now the default; reset target changes):**
- FIND: `Swapping is global, ephemeral (no `localStorage`, reset to **Synthetic parameters** on every reload), and does *not* re-run the simulation or repaint any pre-Run surface — see [ADR-0026](docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md).`
- REPLACE: `The **default** value of `activeParams` on every page-load as of [ADR-0035](docs/adr/0035-default-to-empirical-lognormal-parameters.md). Swapping is global, ephemeral (no `localStorage`, reset to **Empirical parameters** on every reload), and does *not* re-run the simulation or repaint any pre-Run surface — see [ADR-0026](docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md) and [ADR-0035](docs/adr/0035-default-to-empirical-lognormal-parameters.md).`

## ADRs to create

**Create `docs/adr/0035-default-to-empirical-lognormal-parameters.md` with this exact content:**

````md
---
status: accepted — supersedes the page-load-default decision of ADR-0026 (the ephemerality decision of ADR-0026 stands)
---
# Default to empirical lognormal parameters on page-load (supersedes ADR-0026's synthetic default)

[ADR-0026](./0026-empirical-lognormal-parameters-mode-toggle.md) introduced the two parallel
per-**T-shirt size** lognormal tables (`T_SHIRT_PARAMS` synthetic, `T_SHIRT_PARAMS_EMPIRICAL`
empirical) and the ephemeral `param-mode` radio that swaps the module-scoped `activeParams`
reference. It made **synthetic** the page-load default — "the documented, reproducible baseline" —
with empirical opt-in. This ADR reverses **only that default**: on page-load the radio's
`empirical` option is now `checked`, its label carries the `.active` highlight, and `activeParams`
initialises to `T_SHIRT_PARAMS_EMPIRICAL`. Synthetic remains a one-click alternative.

We chose empirical-as-default for two reasons. **(1)** The synthetic↔empirical outcome gap is large
in practice, and the operator runs the simulator in empirical mode by intent; under the old
synthetic default, *synthetic* was therefore the mode that silently produced numbers the operator
did not intend whenever they forgot to flip the radio — the exact "silently reports numbers the
user did not intend" failure ADR-0026 sought to avoid, just pointing the other way for this
operator. Defaulting to empirical removes that footgun. **(2)** The empirical calibration is
re-fit as more realised quarters are folded in (ADR-0026 already anticipated this as an additive
revision), so a realised-data-first default is the logically evolving baseline; the synthetic fit
remains available and unchanged as the documented reference.

We deliberately **kept ADR-0026's other decisions intact**: the toggle stays *ephemeral* (no
`localStorage`, no URL param — [ADR-0002](./0002-client-side-only.md)), so a reload now resets to
**empirical** (not synthetic); both tables and their shared key-set invariant are untouched; and
the sidebar **T-shirt size reference** panel still documents the synthetic bands, so
[ADR-0007](./0007-lognormal-effort-distribution.md)'s hand-recompute contract is unaffected (the
panel is band-as-definition, not band-as-current-sampling-window).

## Consequences

- The empirical default inherits empirical's known calibration caveats (single quarter, `n = 36`;
  `L` is `n = 3`; `2XS`/`XL`/`XL+` have no Q1 data and carry the synthetic `(μ, σ)` through, so for
  those three sizes the empirical default is numerically identical to synthetic). This is accepted:
  empirical is the operator's intended baseline and improves over time.
- Reproducibility of a *synthetic* run is unchanged — synthetic is one radio click away and the
  reference panel still anchors the documented bands.
- A returning user now always starts in empirical mode each session (ephemeral reset target moved
  from synthetic to empirical).

## Considered alternatives

- **Persist the last-used mode in `localStorage`** (so the default tracks the user's habit) —
  rejected: re-opens ADR-0026 jointly with ADR-0002's "no implicit state across sessions" rule,
  which stays load-bearing. A fixed empirical default achieves the operator's goal without it.
- **Stamp the active mode onto the Run output** so an empirical-by-default run is unambiguous —
  out of scope here (additive; ADR-0026 already lists it as a future revision).
````

**Also add a one-line note to `docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md`** (do
not rewrite its body): insert, immediately under its H1 title line, the line:

`> **Superseded in part by [ADR-0035](./0035-default-to-empirical-lognormal-parameters.md)**: the page-load default is now empirical, not synthetic. The ephemeral-toggle / no-persistence decision below still stands.`

## Mechanical toolchain to apply

Human-selected from a dated live web search. `searched_on` is **2026-06-20** for every layer. This
repo's stack: single-file browser app (`index.html`, no build step), npm + `package-lock.json`,
Vitest 2.x, ESLint 9 (flat config), ast-grep. The selection is **fully lockfile-native** (only
`npm audit` is npm-built-in). Library names below are the human's choice from the search — do not
substitute.

- layer: pbt
  status: selected
  choice: fast-check (+ @fast-check/vitest integration)
  version: fast-check 4.8.0, @fast-check/vitest 0.3.0
  install: npm i -D fast-check@4.8.0 @fast-check/vitest@0.3.0
  config:
    pbt.framework: "fast-check"
    pbt.import_symbol: "fc.property|test.prop|it.prop"
    pbt.enabled: true
  rationale: ideal for the Monte Carlo numeric core (Poisson/lognormal/percentile invariants); dominant maintained JS PBT lib
  searched_on: 2026-06-20
  # RE-PIN (human, 2026-06-21): @fast-check/vitest 0.4.1 -> 0.3.0. 0.4.x declares peer
  # vitest@^4.1.0 only, which ERESOLVE-conflicts with this repo's vitest@2.1.9 pin (the original
  # apply-docs blocker). 0.3.0's peer range is "^1 || ^2 || ^3 || ^4" — it satisfies the current
  # vitest 2.x AND stays compatible if vitest is later upgraded to 4.x. fast-check 4.8.0 core is
  # unchanged. Verified against the live npm registry: `npm i -D fast-check@4.8.0
  # @fast-check/vitest@0.3.0` resolves with no ERESOLVE, and 0.3.0 still exports { fc, it, test }
  # so the recorded import_symbol (fc.property|test.prop|it.prop) is unchanged.

- layer: mutation
  status: selected
  choice: StrykerJS (core + vitest-runner)
  version: "@stryker-mutator/core 9.6.1, @stryker-mutator/vitest-runner 9.6.1"
  install: npm i -D @stryker-mutator/core@9.6.1 @stryker-mutator/vitest-runner@9.6.1
  config:
    mutation.tool: "StrykerJS"
    mutation.command: "npx stryker run"
    mutation.enabled: true
    mutation.scope: "changed-files"
  rationale: gives the adequacy gate real teeth on the engine; Stryker mutates inline scripts in index.html, node+jsdom supported
  searched_on: 2026-06-20
  # NOTE for `plan`: scope is changed-files and the only changed file is the 4.6k-line index.html,
  # so a whole-file mutation score of mutation.min_score (default 80) is NOT realistic on day one.
  # The plan MUST set a realistic per-phase min_score for the touched logic and SHOULD use Stryker
  # line-range `mutate` (e.g. "index.html:<start>-<end>") to scope mutation to the param/default
  # region rather than all of index.html.

- layer: sast
  status: selected
  choice: eslint-plugin-security
  version: latest at install (pin the resolved version into package-lock.json)
  install: npm i -D eslint-plugin-security
  config:
    correctness_gate.sast_command: "npm run lint"
  rationale: npm-native SAST folded into the existing eslint flat config; covers eval/unsafe-regex/etc. (ast-grep already blocks the rest)
  searched_on: 2026-06-20

- layer: secret_scan
  status: selected
  choice: secretlint (+ preset-recommend)
  version: latest at install (pin the resolved versions into package-lock.json)
  install: npm i -D secretlint @secretlint/secretlint-rule-preset-recommend
  config:
    correctness_gate.secret_scan_command: "npx secretlint \"**/*\""
  rationale: npm-native, lockfile-pinnable secret scanner; sufficient for a static client-side app
  searched_on: 2026-06-20

- layer: dep_scan
  status: selected
  choice: npm audit (npm built-in)
  version: n/a (ships with npm 11)
  install: (none — npm built-in)
  config:
    correctness_gate.dep_scan_command: "npm audit --audit-level=high"
  rationale: zero-install lockfile CVE check over devDependencies; no third-party lock-in
  searched_on: 2026-06-20

- layer: forbidden_matcher
  status: selected
  choice: ast-grep (pinned as a devDependency)
  version: "@ast-grep/cli 0.43.0"
  install: npm i -D @ast-grep/cli@0.43.0
  config:
    gate.forbidden_pattern_scan.matcher: "ast-grep"
  rationale: matcher already wired (.ast-grep/rules/forbidden-patterns.yml); pin via npm so it lands in the lockfile instead of a brew system binary
  searched_on: 2026-06-20

- layer: lint
  status: selected
  choice: ESLint 9 (flat config) — existing
  version: eslint ^9 (already in package.json)
  install: (none — already installed; eslint-plugin-security adds to it under the sast layer)
  config:
    correctness_gate.lint_command: "npm run lint"
  rationale: already wired (`eslint index.html --max-warnings 0`)
  searched_on: 2026-06-20

- layer: analysis
  status: selected
  choice: ESLint 9 — existing (static subset re-run by the gate)
  version: eslint ^9
  install: (none)
  config:
    correctness_gate.analysis_command: "npm run lint"
  rationale: eslint is the static subset; ast-grep is covered separately by the forbidden-matcher sub-check, so no double-run
  searched_on: 2026-06-20

- layer: verify
  status: selected
  choice: npm run verify — existing composite (the package.json script is extended; see Wiring)
  version: n/a
  install: (none)
  config:
    verify_command: "npm run verify"
  rationale: real composite already (lint + ast-grep + vitest); extended to chain the new static layers
  searched_on: 2026-06-20

- layer: typecheck
  status: n/a
  rationale: vanilla JS, no TypeScript; adding tsc --checkJs to a 4.6k-line single file is a separate effort
  searched_on: 2026-06-20

- layer: sanitizer
  status: n/a
  rationale: managed/interpreted language (JS); sanitizers are native/compiled-only
  searched_on: 2026-06-20

- layer: oracle_free
  status: n/a
  rationale: opt-in metamorphic/differential marker; no oracle-free tests planned for this task
  searched_on: 2026-06-20

- layer: smoke
  status: n/a
  rationale: no build step; single self-contained index.html; verify already loads/boots it
  searched_on: 2026-06-20

# umbrella write — set LAST, only after every selected install + tool-probe succeeds
config:
  toolchain.selected: true
  toolchain.search_dated: "2026-06-20"
  # toolchain.selected_at: <stamp apply-time UTC>
  # toolchain.layers: <apply-docs records the per-layer map {status, choice, version, install, rationale}>

### Wiring apply-docs must perform (so each enabled layer actually runs)

1. **Extend the `verify` npm script** in `package.json` to chain the new static layers (keep order;
   tests last):
   `"verify": "npm run lint && npm run scan:forbidden && npm audit --audit-level=high && npx secretlint \"**/*\" && vitest run"`
2. **Add `eslint-plugin-security`** to `eslint.config.js` (flat config): import the plugin, add it to
   `plugins`, and enable its recommended ruleset so `npm run lint` exercises the SAST layer.
3. **Create `stryker.conf.json`**: `testRunner: "vitest"`, `mutate: ["index.html"]`, a JSON/clear-text
   reporter that prints the mutation score, and the vitest-runner plugin. (Mutation runs in `review`
   / gate sub-check (e), not in `verify`.)
4. **Create `.secretlintrc.json`** using `@secretlint/secretlint-rule-preset-recommend`.
5. **Set `stability.shuffle_flag: "-- --sequence.shuffle"`** (vitest). The leading `-- ` makes npm
   forward the flag to the trailing `vitest run` in the composite `verify`; validate that
   `npm run verify -- --sequence.shuffle` reaches vitest before relying on it.

### Heads-ups apply-docs / the loop must expect (not blockers in themselves)

- **eslint-plugin-security `detect-object-injection`** will almost certainly fire on the param-table
  lookups (`activeParams[sizeLabel]`, `T_SHIRT_PARAMS[size]`, `T_SHIRT_PARAMS_EMPIRICAL[...]`). This is
  the canonical false-positive for that rule. Triage by disabling *only* `detect-object-injection`
  (or annotating those lines), not the whole security preset — otherwise `npm run lint` goes red
  repo-wide on pre-existing code unrelated to this task.
- **`npm audit --audit-level=high`** may report pre-existing devDependency advisories unrelated to
  this change. If so, resolve by upgrading, or record an accepted exception — do not let an
  unrelated advisory permanently block the loop.

## Plan logistics

- **slug**: `empirical-lognormal-default`  (task id `0022`; ADR `0035`)
- **user-visible goal**: on page-load (no interaction) the simulator defaults to the **Empirical
  parameters** lognormal table instead of synthetic.
- **entry point**: page load + the `param-mode` radio group in the **Lognormal Parameters** sidebar.
- **relevant files/dirs**:
  - `index.html` — the only production file. Exact change sites (verified 2026-06-20; re-grep before editing):
    - `index.html:952` `<label id="param-label-synthetic" class="active">` → remove `class="active"`.
    - `index.html:953` `<input type="radio" name="param-mode" value="synthetic" checked>` → remove `checked`.
    - `index.html:956` `<label id="param-label-empirical">` → add `class="active"`.
    - `index.html:957` `<input type="radio" name="param-mode" value="empirical">` → add `checked`.
    - `index.html:1333` `let activeParams = T_SHIRT_PARAMS;` → `let activeParams = T_SHIRT_PARAMS_EMPIRICAL;`
    - The `change` handler (`index.html:4524-4528`) is **unchanged** — it already swaps both ways.
  - `CONTEXT.md` — glossary (see CONTEXT.md edits above).
  - `docs/adr/0035-...md` (new), `docs/adr/0026-...md` (note), `docs/adr/0007-...md` (reference).
- **test-harness locations**: `tests/**` (vitest; `tests/**/*.test.js`). Acceptance test for this
  task: assert the page-load default. Existing `tests/verification/0003-sanity-check-engine-mean.test.js`
  already sets `activeParams = T_SHIRT_PARAMS_EMPIRICAL` explicitly (line ~214) and is unaffected by
  the default flip, but confirm it still passes.
- **verify command**: `npm run verify` (post-Wiring composite above).
- **phase-count estimate**: 1 (hint only; `plan` sets the authoritative `total_phases`).
- **acceptance criteria** (lint-cleared — Part C found no contradiction / ambiguity / unsatisfiable / unaligned-one-way-door):
  - **AC-1**: On page-load with no user interaction, the **Empirical** radio is `checked` and its
    label (`#param-label-empirical`) carries the `.active` class; the synthetic label does not.
  - **AC-2**: On page-load with no user interaction, `activeParams === T_SHIRT_PARAMS_EMPIRICAL`
    (every sampler — `sampleLognormal`, `tshirtToPersonMonths` — reads the empirical table without
    any user action).
  - **AC-3**: Selecting the **Synthetic** radio still switches `activeParams` to `T_SHIRT_PARAMS`
    and moves the `.active` highlight (existing toggle behaviour preserved, both directions).
  - **AC-4**: The selection remains ephemeral — a page reload resets to **Empirical** (no
    `localStorage`/persistence is introduced).
- **asserted invariants**:
  - **I-1**: The radio's `checked` option and the initial value of `activeParams` are always
    consistent on load (no state where the UI shows empirical but `activeParams` is synthetic, or
    vice-versa). Covered jointly by AC-1 + AC-2.
- **decision constraints (one-way doors)**: the only one-way door — the page-load default selection —
  is captured by **ADR-0035** (surprising: it reverses ADR-0026), so no separate `DC-n` is needed.
- **external sources mirrored**: none (no third-party API/spec; the empirical constants are an
  in-repo calibration governed by ADR-0026).
- **out of scope** (do NOT do these):
  - Introducing any persistence (`localStorage`/URL) — ADR-0026's ephemerality stands.
  - Recalibrating / editing the `T_SHIRT_PARAMS_EMPIRICAL` constants (future, separate task).
  - Any change to the synthetic table or the T-shirt size reference panel.

## Files the next phase MUST read

- `docs/backlog/0022-empirical-lognormal-default/handover-01-grill.md` — this file (the prepared edits + toolchain).
- `CONTEXT.md` — glossary; **Synthetic parameters** / **Empirical parameters** / **Recognised t-shirt size** entries.
- `docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md` — the decision being superseded in part; why synthetic was the default and why the toggle is ephemeral.
- `docs/adr/0007-lognormal-effort-distribution.md` — the synthetic-fit reproducibility contract that stays intact.
- `index.html` — change sites listed in Plan logistics (radios ~952-958, `activeParams` init 1333, change handler 4524-4528, `T_SHIRT_PARAMS_EMPIRICAL` 1322-1330).

## Context the next phase needs

- The production change is genuinely 5 small edits in `index.html`; the *weight* of this task is the
  documentation reversal (ADR-0035 + CONTEXT) and the **one-time v3 toolchain install** in the
  toolchain section — apply-docs does the toolchain; plan/atdd/implement do the `index.html` change.
- ADR-0026's stale `index.html:NNNN` references (e.g. `activeParams` at `:1264`, handler at
  `:3293-3300`) predate this task; the verified current lines are in Plan logistics. Do not chase
  fixing the stale refs — out of scope.
- Toolchain forcing: once `mutation.enabled` and `pbt.enabled` are `true` with real commands, the
  gate's forcing checks are satisfied without any trusted-overlay N/A. No operator overlay action is
  required for this task (the N/A escape hatch was not used).

## Definition of done (for apply-docs)

- The three `CONTEXT.md` edits are applied; `docs/adr/0035-...md` exists with the content above and
  `docs/adr/0026-...md` carries the superseded-in-part note.
- Every `selected` toolchain layer is installed, its Wiring performed, its `config:` keys written,
  and each tool **probed to run** (lint incl. security plugin, ast-grep, npm audit, secretlint,
  vitest, `npx stryker run` dry/short); `toolchain.selected: true`, `toolchain.search_dated`,
  `toolchain.selected_at`, and `toolchain.layers` are written **last**.
- `apply-docs`'s handover records `toolchain_applied` (per-layer `layer → choice`, `"n/a"` for the
  N/A'd layers) and advances `stage` to `plan`. Any failed/unrunnable install ⇒ `blocked`, not advance.
