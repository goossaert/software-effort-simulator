---
schema: backlog-handover/v1
task_id: "0022"
produced_by_phase: review
feature_phase: 1
for_next_phase: review
outcome: blocked
reason: "mutation adequacy gate unrunnable — `npx stryker run` produces no score (scoped `mutate` ranges instrument 0 mutants; vitest-runner `related` finds no harness-loaded tests); needs a human stryker.conf.json/toolchain fix or a deliberate mutation N/A"
produced_at: 2026-06-21T18:59:41Z
produced_commit: 62f80b5ff2a7bcc3784bde733444cf6a52ceaba2
test_commit: f7eb97de2c91eba6cd5b7ec51db1a3364b92f263
impl_commit: 62f80b5ff2a7bcc3784bde733444cf6a52ceaba2
---

## Summary

Integrity review of Phase 1 (`test_commit..impl_commit` = `f7eb97d..62f80b5`). **Every integrity
axis is clean** — no test files changed between the test and impl commits, no test-gaming patterns,
both `[test-only]` invariants (I-1, I-2) satisfied, the sole required PBT property covered by a
genuine generator-based `test.prop` reading the size set from the loaded window, oracle class (a)
needs nothing, and the **negative control PASSED** (a one-line revert of the default binding →
suite exit 1, 5 failed; reverted → exit 0, 8 passed). **BLOCKED** on one item only: the scored
**mutation adequacy gate** required by the plan's Definition of Done. With `mutation.enabled: true`
and `mutation.command = "npx stryker run"`, the engine **cannot produce a score** on this repo as
configured, and the fix is a human toolchain/config change — not a production fix and not a missing
test. `produced_commit` is set to the reviewed impl commit (a phase cannot know its own commit SHA);
the human / re-run derives SHAs from git log of the atdd/implement handovers.

## Why BLOCKED (and not FAIL→implement or FAIL→atdd)

`npx stryker run` (run verbatim — no tool/flag substituted) **exited 1 at the dry-run**:

```
WARN  Glob pattern "index.html:1333" did not result in any files.
INFO  Instrumented 1 source file(s) with 0 mutant(s)
WARN  Vitest failed to find test files related to mutated files. Either disable `vitest.related`
      or import your source files directly from your test files.
INFO  No tests were found
ERROR No tests were executed. Stryker will exit prematurely.
```

Two independent, **config-level** blockers (full root-cause in the mutation report):

1. **Scoped `mutate` ranges instrument 0 mutants.** `"index.html:1333"` is invalid mutation-range
   syntax (no `-end`); `"index.html:4522-4531"` is valid but emits 0 mutants for the inline-HTML
   `<script>`. A diagnostic whole-file run (`mutate: ["index.html"]`) on the **same committed tree**
   instrumented **3589 mutants** — Stryker *can* mutate this HTML, so the **scoped line-range form
   is the defect**, not a capability gap.
2. **`vitest.related` discovers no tests.** The suite loads `index.html` via the JSDOM harness
   (`fs.readFileSync` + `runScripts:'dangerously'` in `tests/harness.js`) with **no `import` edge**,
   so Stryker's default `vitest --related index.html` finds nothing and aborts.

This is **not** a missing-test gap (the tests exist, pass, and kill the Step-6 regression; no
kill-test atdd could write would make `--related` see fs-loaded tests or make the line-range filter
emit mutants) and **not** a production bug (no re-implement of `index.html` changes Stryker's
scoping/runner integration). It is a mutation **misconfiguration** the integrity reviewer is
required to `blocked` on rather than pass. The review may not edit `stryker.conf.json` itself, and
doing so to reach a score would be moving goalposts.

## Instructions for the next phase (human triage → then re-run `review`)

A human owning the grill→apply-docs **toolchain selection** must make the mutation gate runnable,
then the loop re-runs the **same `review` stage** (stage is left at `review`). Pick one:

1. **Set `vitest: { related: false }`** in `stryker.conf.json` (documented fix for non-imported /
   fs-loaded sources) so the full suite is the kill set; **and**
2. **Replace the non-working scoped `mutate` form** with one that emits >0 mutants for the
   param-mode region — e.g. verify `["index.html:1333-1333", "index.html:4522-4531"]` actually
   instruments mutants, or choose a different scoping. (Whole-file = 3589 mutants is impractical and
   beyond the plan's intended scope.) Confirm the scoped run prints a real `killed/total` score.
3. **Or** deliberately record the mutation layer **N/A** for this single-file-HTML architecture
   (`toolchain.layers.mutation.status: "n/a"` + `mutation.enabled: false`) with rationale — a human
   toolchain decision, not an autonomous one — which waives the scored gate (the Step-6 negative
   control remains the smoke check).

After the fix, re-running `review` should reach the scoped-mutation step, score the param-mode
region against the 70% threshold, and (the rest already being clean) **PASS** → hand to
`review-correctness`.

## Files the next phase MUST read

- `docs/reviews/0022-empirical-lognormal-default-phase-1-review-01.md` — this review in full (all
  steps; integrity axes all clean; the BLOCKED rationale).
- `docs/reviews/0022-empirical-lognormal-default-phase-1-mutation-01.md` — the Stryker evidence +
  root-cause diagnosis + the human-actionable fix options.
- `stryker.conf.json` — the `mutate` ranges (0 mutants) + the missing `vitest.related:false`; the
  two things to fix.
- `tests/harness.js` — why `vitest.related` fails (fs-read load, no `import` edge).
- `docs/plans/0022-empirical-lognormal-default.md` — Phase-1 behavioral rule, invariants,
  counterexamples, the scoped-mutation DoD.
- `backlog.config.json` — `mutation.*` (enabled/command/min_score/scope) + `toolchain.layers.mutation`.
- `tests/acceptance/0022-empirical-default-on-load.test.js` + `…-params-property.test.js` — the
  committed RED-then-green suite (unchanged since atdd; the property uses `test.prop`).
- `docs/backlog/0022-empirical-lognormal-default/handover-06-implement-p1.md` — the implement
  handover (test_commit/impl_commit derivation; the `package.json` verify-bootstrap context).

## Context the next phase needs

**Verified clean (integrity):**
- Test immutability: `git diff f7eb97d..62f80b5 -- tests features e2e acceptance` is **empty**.
- Test gaming: none. Production diff = `index.html` (the feature flip) + `package.json` (a benign
  `verify` bootstrap — guarded `npm ci`, no correctness layer weakened). No config/threshold file
  changed in the impl diff (`stryker.conf.json`/`vitest.config`/eslint/`backlog.config.json` all
  unchanged). No suppression tokens in added lines.
- Invariants: I-1, I-2 both `[test-only]`, SATISFIED. No `[contract]` invariants (plan + config
  agree; gate (g) off).
- Coverage: AT-1..AT-4 + the per-size property + triangulation examples all map to the plan; oracle
  (a); parity N/A. Minor non-blocking note: AT-4 asserts no-persistence on `localStorage` only (not
  sessionStorage/URL) — moot, the impl adds zero persistence.
- Negative control: PASS, real exit codes (bug → exit 1 / 5 failed; revert → exit 0 / 8 passed).
- Boot smoke: no-op (`smoke_command` empty, `toolchain.smoke = n/a`); base confirmed green via the
  Step-6 clean run (8/8 exit 0).

**Autonomously-taken (gated) decisions, recorded here (no user — backlog loop mode):**
1. **Ran `mutation.command` verbatim** (`npx stryker run`) for the verdict — did not substitute a
   tool or add flags, per Step 7.
2. **Diagnostic only (not committed, tree left clean):** a throwaway whole-file
   `mutate:["index.html"]` + `vitest.related:false` run (temp config in `/tmp`, deleted) to prove
   Stryker CAN mutate this HTML (3589 mutants) — establishing the blocker is the scoped-range config
   + `vitest.related`, not a capability gap. No repo file was changed by it.
3. **Verdict = BLOCKED, not FAIL.** A mutation misconfiguration that prevents scoring is the skill's
   sanctioned `blocked` case; neither atdd (writes tests) nor implement (fixes production) can
   resolve a Stryker/vitest-runner integration defect under the immutability/review-scope rules, and
   there are no surviving mutants to hand atdd as a kill-test spec. The fix is a human toolchain/
   config change (or a deliberate mutation N/A).
4. **Index transition for BLOCKED:** left `stage: review`, `status`, `current_phase: 1`,
   `retry_count`, `next_handover` **unchanged** (per LOOP-MODE BLOCKED rule); set `blocked_reason`;
   appended the review file to `artifacts.reviews`; refreshed `updated_at` + the human summary. The
   loop reads this handover's `outcome: blocked` (newest handover) and flags for a human.
5. **`produced_commit`** set to the reviewed impl commit `62f80b5` (a phase cannot embed its own
   commit SHA); SHAs are derived from git log of the atdd/implement handovers as usual.

## Definition of done (for the resolving re-run)

`npx stryker run` (scoped to the param-mode region) produces a real `killed/total` score and the
scoped mutation score is **≥ 70%** — **or** the mutation layer is deliberately recorded N/A by a
human — and the integrity `review` re-runs to **PASS** (the other axes already being clean), handing
off to `review-correctness`.
