---
schema: backlog-handover/v1
task_id: "0022"
produced_by_phase: apply-docs
feature_phase: null
for_next_phase: apply-docs
outcome: blocked
reason: "pbt toolchain install failed (ERESOLVE): `npm i -D fast-check@4.8.0 @fast-check/vitest@0.4.1` — @fast-check/vitest@0.4.1 requires peer vitest@^4.1.0 but repo pins vitest@2.1.9; resolution is an upstream one-way-door (re-pin the integration package or approve a vitest 4.x major upgrade), not auto-substitutable by apply-docs."
produced_at: 2026-06-21T14:37:12Z
produced_commit: ae446c4ad081530023fc666b4f07fd4b7507c821
blocked:
  flavor: missing-capability
  failing_layer: pbt
  failing_command: "npm i -D fast-check@4.8.0 @fast-check/vitest@0.4.1"
  error: "ERESOLVE — peer vitest@^4.1.0 required by @fast-check/vitest@0.4.1; repo has vitest@2.1.9 (declared ^2.1.8)"
---

## Summary

apply-docs ran the boot smoke check (GREEN) and prepared the documentation edits, but **stopped
at Step 3b (Mechanical toolchain) with a `blocked` outcome**: the human-selected `pbt` layer
install fails an npm peer-dependency resolution. `@fast-check/vitest@0.4.1` (the integration
package whose `test.prop`/`it.prop` API is the recorded `pbt.import_symbol`) requires peer
`vitest@^4.1.0`, but this repo pins `vitest@2.1.9` (package.json `^2.1.8`). The install command
exits `1` (`ERESOLVE`) and cannot be satisfied without either re-pinning the integration package
to a vitest-2-compatible release **or** performing a `vitest` 4.x major upgrade — both are
**upstream one-way-door selections** that apply-docs must never make autonomously (it installs and
records the human's choice; it never substitutes, re-pins, or second-guesses a library, nor
force-installs a knowingly-broken peer resolution). Per the apply-docs Step 3b contract and the
grill handover's own instruction #3 ("A failed/unrunnable install ⇒ blocked — never advance with a
tool missing"), the phase blocks and **does not advance `stage`**.

All partial nominal work was reverted so this commit is clean and a re-run is idempotent: the
CONTEXT.md edits, ADR-0035, the ADR-0026 note, and the one successful install (StrykerJS) were all
rolled back. `toolchain.selected` remains `false` (never written), so once a human resolves the
pin the loop re-dispatches apply-docs, which re-applies every prepared section from scratch.

## What was attempted (and its result)

- **Boot smoke** — no `smoke_command` configured (empty default ⇒ logged no-op); minimal base
  health check run instead: `npm run lint` exit 0, `npm run scan:forbidden` (ast-grep) exit 0.
  Base inherited at `ae446c4` is **GREEN**.
- **CONTEXT.md edits (Step 2)** — the three glossary edits were applied successfully and then
  **reverted** for a clean blocked commit (they re-apply cleanly on re-run).
- **ADRs (Step 3)** — `docs/adr/0035-default-to-empirical-lognormal-parameters.md` was created
  (number re-derived as `0035`, confirmed next) and the supersede note added to `0026`; both
  **reverted** for a clean blocked commit.
- **Toolchain installs (Step 3b)**, in order:
  - `pbt` (`npm i -D fast-check@4.8.0 @fast-check/vitest@0.4.1`) → **FAILED, exit 1 (ERESOLVE)**.
    See `blocked.error` above. THIS IS THE BLOCKER.
  - `mutation` (`npm i -D @stryker-mutator/core@9.6.1 @stryker-mutator/vitest-runner@9.6.1`) →
    succeeded (exit 0); **reverted** (package.json restored) since the phase is blocking.
  - `sast` / `secret_scan` / `dep_scan` / `forbidden_matcher` / remaining layers → **not
    attempted** (the loop blocks on the first failed required install).
- `backlog.config.json` was **not modified** — no `config:` keys or `toolchain.*` provenance were
  written. `toolchain.selected` is still `false`.

## What a human must decide (the one-way door)

Pick ONE and update `handover-01-grill.md`'s `## Mechanical toolchain to apply` (`pbt` layer)
accordingly, then let the loop re-run apply-docs:

1. **Re-pin `@fast-check/vitest`** to a release whose peer range admits `vitest@2.x` (i.e. a 0.1.x
   line, contemporaneous with vitest 2), keeping `fast-check@4.8.0` core. Lowest-risk: no engine
   change. Verify the chosen version's `test.prop`/`it.prop` API still matches the recorded
   `pbt.import_symbol`.
2. **Upgrade `vitest` to `^4.1.0`** (and any peers: `@vitest/browser`, `@vitest/ui`, jsdom config)
   so `@fast-check/vitest@0.4.1` resolves. Larger blast radius — a test-runner major bump touches
   the existing suite and ADR-0031 (the vitest/jsdom harness); should itself be grilled/aligned.
3. **Mark `pbt` N/A** for this repo (record `status: n/a` + reason) only if the team accepts no
   property-based testing — but the grill handover's AC set leans on PBT for the numeric core, so
   this is the least-aligned option.

## Additional heads-up the human should weigh (not the blocker, but it affects the toolchain premise)

- **`package-lock.json` is `.gitignore`d in this repo** (`.gitignore:2`), and `node_modules/` too.
  The toolchain selection's stated rationale is "fully lockfile-native … pin the resolved version
  into package-lock.json", and apply-docs Step 5 expects to stage the manifest **+ lockfile**. With
  the lockfile untracked, dev-dependency pins would **not** be committed, and the hermetic verify /
  gate sub-check (b) `npm ci` step (which requires a committed lockfile) has nothing to install
  from. The human should decide whether to **un-ignore `package-lock.json`** as part of resolving
  this task, otherwise the v3 toolchain's reproducibility guarantees are undermined regardless of
  the fast-check fix.

## Files the next phase (re-run apply-docs) MUST read

- `docs/backlog/0022-empirical-lognormal-default/handover-01-grill.md` — the prepared CONTEXT edits,
  ADRs, and the `## Mechanical toolchain to apply` section to re-apply (with the `pbt` layer fixed).
- `docs/backlog/0022-empirical-lognormal-default/handover-02-apply-docs.md` — this file; the blocker
  detail and the decision the human made.
- `CONTEXT.md` — glossary (the three edits re-apply against the un-edited text).
- `docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md` — receives the supersede note.
- `package.json` / `eslint.config.js` — the toolchain wiring targets (vitest pin lives in
  package.json; eslint-plugin-security wires into eslint.config.js).

## Context the next phase needs

- **Boot smoke**: passed (no `smoke_command`; `npm run lint` + ast-grep scan both exit 0 on the
  inherited `ae446c4` base).
- **ADR number**: `0035` was re-derived as next against `docs/adr/` (last = `0034`); it is still
  free for the re-run to claim.
- **State is clean**: no doc edits, no ADRs, no `backlog.config.json` writes, no committed manifest
  changes survive in this commit. `toolchain.selected: false`. The re-run starts from a clean tree
  and re-applies every prepared section idempotently.
- **Do NOT** auto-substitute or re-pin the `pbt` library inside the loop — that one-way-door is the
  human's to make (the whole point of Step 3b's "install, never re-decide" rule).

## Definition of done (for the re-run apply-docs, after the human fix)

- The `pbt` install resolves and `pbt.import_symbol` imports; every other `selected` layer installs,
  its Wiring is performed, its `config:` keys are written, each tool is probed to run; the three
  CONTEXT edits land; ADR-0035 exists and ADR-0026 carries the supersede note; `toolchain.selected`,
  `toolchain.search_dated`, `toolchain.selected_at`, and `toolchain.layers` are written **last**;
  `stage` advances to `plan`.
