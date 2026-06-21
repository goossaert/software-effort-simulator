---
schema: backlog-handover/v1
task_id: "0022"
produced_by_phase: implement
feature_phase: 1
for_next_phase: review
outcome: success
reason: ""
produced_at: 2026-06-21T18:27:00Z
produced_commit: f7eb97de2c91eba6cd5b7ec51db1a3364b92f263
---

## Summary

Re-ran implement for Phase 1 after the post-stage gate rewound the prior implement commit
(`165edeee`) for the **hermetic-verify** sub-check (`verify_command exited 127 on rerun 1/3 of a
fresh checkout`). Two production-only edits, no `tests/**` changes:

1. **The feature itself** — re-applied the six in-place `index.html` edits that flip the
   page-load default from **Synthetic** to **Empirical** lognormal parameters (the rewind had
   reverted them). The committed Phase-1 tests now pass (AT-1..AT-4 + the per-size property).
2. **The hermetic-verify root-cause fix** — `package.json` `verify` now self-bootstraps its
   dependencies from the lockfile when `node_modules` is absent, so the gate's bare-worktree
   re-run installs deps before any tool runs.

Stable green (acceptance 3/3, property 5/5; 3 default-order reruns + 1 `--sequence.shuffle`, 8/8),
full `npm run verify` exit 0 (234 passed | 1 skipped), and — critically — a **gate-faithful
hermetic verify now PASSES** (bare worktree, no `npm ci` by me, 3 reruns + shuffle all exit 0).
Index advanced to `stage: review`, `next_handover: handover-06-implement-p1.md`.

## Root cause of the gate rejection (and the fix)

The gate's `gate_hermetic_verify` (backlog tool `lib/gate.sh:235-286`) materialises a **fresh
detached worktree** of the commit (`git worktree add --detach <tmp> HEAD`) and runs
`verify_command` directly, N=`green_reruns`(3) times + 1 randomized-order pass, in one reused
worktree. It does **not** run `npm ci` / any dependency install, and `node_modules/` is
`.gitignored`, so the worktree is **bare**. `net_disabled` is **absent** on this host, so the gate
runs verify with the network available. The old `verify_command` assumed deps were pre-installed,
so its first layer (`eslint index.html`) was not on PATH:

    > lint
    > eslint index.html --max-warnings 0
    sh: eslint: command not found        # => exit 127

(Confirmed byte-for-byte against the gate evidence
`.backlog-logs/20260621_200627_0022_implement_p1.log.gate`, and reproduced locally in a bare
worktree.) This surfaced now because **0022 is the first task under the v3 hermetic gate** — prior
tasks (0020/0021) predate it.

**Fix (production, non-test — `package.json` `verify` script):**

    "verify": "{ [ -e node_modules/.bin/eslint ] || npm ci; } && npm run lint && \
               npm run scan:forbidden && npm run scan:deps && \
               npx secretlint \"**/*\" && vitest run"

It prepends a guarded `npm ci` using the same `command -v`/guard idiom already in
`scan:forbidden`. No tool is changed, disabled, downgraded, or scope-narrowed — the only addition
is the documented hermetic precondition (LOOP-MODE *Hermetic verify*: "deps from the lockfile via
`npm ci`"). In the working tree the guard finds eslint and **skips** the install (fast); in the
gate's bare worktree it runs `npm ci` once on rerun 1 and reuses `node_modules` thereafter.

## Instructions for the next phase (review)

1. Review the `test_commit..impl_commit` production diff (derive via git log; test_commit =
   `f7eb97de2c91eba6cd5b7ec51db1a3364b92f263`, impl_commit = this implement commit at HEAD). The
   production diff is exactly `index.html` (6 in-place edits) + `package.json` (1 verify-script
   edit) — nothing else.
2. **Note the second production change.** Beyond the feature, `package.json`'s `verify` script was
   changed to self-bootstrap deps (see root-cause above). This is infrastructure, not feature
   logic; it is **not** test gaming (no `NODE_ENV`/fixture/test-id branch, no tool weakened) and is
   required for the hermetic gate to pass at all. Confirm it does not weaken any correctness layer.
3. **Scoped mutation ≥ 70%** on the param-mode region remains the review/gate's scoring step.
   `stryker.conf.json` `mutate` is unchanged (`["index.html:1333", "index.html:4522-4531"]`);
   re-grepped this session — line 1333 is the changed initializer
   (`let activeParams = T_SHIRT_PARAMS_EMPIRICAL;`) and 4524-4530 (the `change` handler) sit inside
   4522-4531. Edits were in-place so the anchors did not drift; no config change needed.

## Files the next phase MUST read

- `docs/plans/0022-empirical-lognormal-default.md` — Phase-1 behavioral rule, AT-1..AT-4, the PBT
  property + generator domain, oracle class (a), counterexamples, forbidden shortcuts, scoped-mutation DoD.
- `tests/acceptance/0022-empirical-default-on-load.test.js` — AT-1/AT-2/AT-4 (unchanged since atdd).
- `tests/acceptance/0022-empirical-default-params-property.test.js` — per-size property + AT-3 + examples (unchanged).
- `docs/atdd-logs/0022-empirical-lognormal-default-phase-1-hermetic-verify.log` — the gate-faithful
  hermetic re-run evidence (the sub-check that previously failed, now PASS).
- Per-layer correctness-gate logs `…-phase-1-{lint,sast,forbidden,dep-scan,secret-scan}.log`
  (all exit 0) and `…-{typecheck,sanitizer}.log` (N/A).
- `handover-05-gate-p1.md` — the gate-findings handover this retry resolves.

## Context the next phase needs

**Production change set (the entire impl diff):**
- `index.html:952` removed `class="active"` from `#param-label-synthetic`.
- `index.html:953` removed `checked` from the synthetic radio.
- `index.html:956` added `class="active"` to `#param-label-empirical`.
- `index.html:957` added `checked` to the empirical radio.
- `index.html:1332` comment `default: synthetic` → `default: empirical`.
- `index.html:1333` `let activeParams = T_SHIRT_PARAMS;` → `let activeParams = T_SHIRT_PARAMS_EMPIRICAL;`.
- `index.html:4522-4531` the `param-mode` `change` handler — **byte-for-byte unchanged** (AT-3 passes
  through the real swap logic).
- `package.json` `verify` script — guarded `npm ci` prepended (hermetic-verify fix, above).

**Verification evidence (all command/exit-code/log backed):**
- Inner tests stable green: acceptance 3/3, property 5/5; 3 default-order reruns + 1
  `--sequence.shuffle` pass, 8/8 every run. Property seed unpinned by design (atdd decision) —
  outcome is invariant GREEN now that the default is empirical.
- `npm run verify` (working tree): exit 0, 234 passed | 1 skipped (235).
- Gate-faithful **hermetic verify**: bare `git worktree` of the staged tree, `verify` run 3× +
  1 shuffle in one reused worktree, network available (net_disabled absent). rerun 1 ran `npm ci`
  ("added 419 packages") then all layers; reruns 2/3 skipped the install; **all exit 0**, 234
  passed | 1 skipped each; `grep -c "eslint: command not found"` across all 4 logs = 0.
- Correctness-gate layers: lint, sast (eslint-plugin-security), forbidden (ast-grep), dep-scan
  (npm audit wrapper; the 2 accepted dev-server/UI-only advisories allow-listed), secret-scan all
  exit 0; typecheck + sanitizer recorded N/A.
- No `tests/**` drift: `git diff --name-only f7eb97d..HEAD -- tests features e2e acceptance` empty;
  `git diff --cached --name-only -- tests features e2e acceptance` empty at commit.

**Autonomously-taken (gated) decisions, recorded here (no user — backlog loop mode):**
1. **Fixed the hermetic-verify failure inside `verify_command` rather than emitting BLOCKED.**
   The gate's bare-worktree re-run with no `npm ci` is the documented hermetic contract's missing
   half; making `verify` self-bootstrap from the lockfile satisfies that contract without
   re-deciding the toolchain (same tools, same thresholds). It is a production (non-test) config
   edit, within implement's scope, and is the minimal change that turns the failing sub-check
   green. The narrower dep-scan/network heads-up the atdd handover flagged did not bite
   (net_disabled is absent → network available → `npm ci` and `npm audit` both reach the registry);
   the actual failure was the more fundamental "no node_modules at all", which this fix resolves.
2. **Guard idiom + sentinel.** Used `[ -e node_modules/.bin/eslint ]` (the exact first-failing
   binary, tied to node_modules rather than global PATH) as the install sentinel, in a brace group
   so a failed `npm ci` aborts verify loudly instead of falling through to a misleading
   eslint-not-found. Mirrors the repo's existing `scan:forbidden` `command -v` guard.
3. **Did not run full StrykerJS mutation here.** The gate's `mutation_command` is empty (mutation
   is not a gate sub-check); scoped mutation ≥70% is the review's scoring step (per the prior
   atdd/implement note). I confirmed the `mutate` ranges did not drift (edits in-place) — that is
   implement's obligation per the plan DoD.
4. **Handover numbering.** Max existing handover = 05 (`handover-05-gate-p1.md`), so this is
   `handover-06-implement-p1.md`. `produced_commit` set to the test commit per the prior implement
   convention; review derives `test_commit..impl_commit` from git log.

## Definition of done (met)

Production-only edits flip the page-load default to **Empirical parameters** so the committed
Phase-1 tests pass (AT-1..AT-4 + per-size property), and the `verify` self-bootstrap makes
`npm run verify` exit 0 under the **gate-faithful hermetic verify** (the sub-check that previously
failed). Every enabled correctness-gate layer green; no layer disabled/downgraded/scope-narrowed;
no `tests/**` edits. The re-run commit passes the hermetic-verify gate sub-check that rejected the
prior commit. Stage → **review**, `next_handover: handover-06-implement-p1.md`.
