---
schema: backlog-index/v1
id: "0023"
slug: error-report-tab
title: Error Report tab
stage: review-correctness
status: ready
priority: normal
flagged_for_human: false
total_phases: 2
current_phase: 2
retry_count: 0
max_retries: 3
next_handover: handover-18-review-p2.md
updated_at: 2026-06-24T08:15:00Z
created_at: 2026-06-22T18:49:16Z
blocked_reason: ""
artifacts:
  plan: docs/plans/0023-error-report-tab.md
  test_commit: 36d5b1c8c94e2e40c62787d660a2354622655daa
  impl_commit: 79dcd45d80f09efb7b13c44738deb98e4373a441
  reviews:
    - docs/reviews/0023-error-report-tab-phase-1-review-01.md
    - docs/reviews/0023-error-report-tab-phase-2-review-01.md
    - docs/reviews/0023-error-report-tab-phase-2-correctness-01.md
    - docs/reviews/0023-error-report-tab-phase-2-review-02.md
---
# 0023 — Error Report tab

Add a new advisory **Error Report** results tab (slug `error-report`, last in the
tab bar; org stays the resting tab) that, after a Run **completes**, lists
data-quality findings the simulator otherwise handles silently — unrecognized
t-shirt sizes, out-of-scope/orphan epics, historical quarters with no loaded
epics, duplicate initiative keys and quarter-label variants, degenerate λ=0 /
total-K=0 runs, capacity/iterations coercion, constant-work categories matching no
Group, and the four multi-quarter-initiative conditions.

Findings are collected by **instrumenting the actual Run path** (so the report can
never disagree with what the simulation computed) and are **advisory only**: the
report never aborts or alters a Run, and the two existing hard stops are unchanged.
The known multi-quarter forward double-count is **reported at ERROR but not fixed**
here — the underlying per-key-vs-per-row unit-consistency fix is a separate future
task. See [ADR-0037](../../adr/0037-error-report-advisory-diagnostics.md).

> **apply-docs done (2026-06-22):** the five glossary terms are in `CONTEXT.md`
> (four new + the pre-existing **Recognised t-shirt size** augmented in place) and
> ADR-0037 is created; toolchain was already selected (no-op). Next stage: **plan**.
>
> **plan done (2026-06-22):** `docs/plans/0023-error-report-tab.md` written with
> **`total_phases: 6`** thin vertical slices — (1) tab + finding model + render +
> empty state + unrecognised-size; (2) scope/calibration exclusions; (3)
> run-parameter / degenerate-run findings; (4) duplicates & overlaps; (5) initiative
> & cross-ref integrity + constant-work exclusion; (6) multi-quarter section + full
> presentation contract. AC-1…AC-13, I-1…I-5, and DC-1…DC-5 are formalised (not
> re-decided); the 22 test-facing `code`s + per-code severities are pinned in the
> plan's Data models. Next stage: **atdd** (feature-phase 1).
>
> **atdd p1 done (2026-06-22):** Phase-1 acceptance + property tests committed
> under `tests/acceptance/0023-phase-1-*.test.js` (6 acceptance AT-1…AT-5 + 7
> inner/property tests incl. 2 `fast-check` properties). **Stable RED** confirmed
> across 5 flakiness reruns (acceptance 5/5 exit 1, inner 5/5 exit 1); RED logs in
> `docs/atdd-logs/0023-error-report-tab-phase-1-*.log`. Tests target only the named
> seams (`prepareSimulationData(...).findings`, `renderErrorReport(findings)`, the
> rendered `#tab-error-report` DOM). Next stage: **implement** (feature-phase 1).
>
> **human fix — UNBLOCKED (2026-06-22):** the implement-phase block is resolved. A
> human (operator-approved) **migrated** the two conflicting frozen tab-bar
> assertions to the 7-tab reality — exactly the precedent set when feature 0021
> Phase 6 migrated 0020-AT-1 for the Constant work tab:
> - `0020-phase-2-groups-tab.test.js` AT-1 → `toHaveLength(7)`, slug array now ends
>   `…, 'groups', 'error-report'`; Groups asserted sixth, **Error Report** last.
> - `0021-phase-6-constant-work-tab.test.js` AT-1 → same array; Constant work fifth,
>   Groups sixth (its invariant — Constant work immediately before Groups — unchanged).
>
> The 0023 Phase-1 tests are **unchanged**. `npm run verify` now exits **0** (247
> passed, 1 skipped). The migration lands in a **separate chore commit that is a
> descendant of the implement commit `d77e0ab`**, so the integrity review's diff
> range `test_commit (36d5b1c) .. impl_commit (d77e0ab)` stays **production-only with
> zero test-file changes** (stage-review immutability rule satisfied). The implement
> production code is complete and committed at `d77e0ab`; advanced to **review**
> (feature-phase 1) reading `handover-05-implement-p1.md`.
>
> **implement p1 BLOCKED (2026-06-22):** Phase-1 production code is complete (13/13
> Phase-1 tests pass stably) but `npm run verify` exits 1 because frozen tests
> `0020-AT-1` and `0021-AT-1` assert `toHaveLength(6)` + exact slug array ending in
> `groups` — both break with the 7th `error-report` tab button required by 0023-AT-1.
> Human test-fix needed: loosen 0020/0021 AT-1 to check positional relationships
> (constant-work=5th, groups=6th) rather than total count. See
> `handover-05-implement-p1.md` for proposed fix. **`flagged_for_human: true`.**
>
> **review (integrity) p1 — FAIL (2026-06-22):** integrity is otherwise clean — no
> test gaming, test immutability intact (the human's 0020/0021 migration in `fdbb375`
> is outside the reviewed range `36d5b1c..d77e0ab` and production-only-free), both
> required PBT properties present, advisory I-1 satisfied, behavioral negative control
> killed. **But** the plan tags invariants **I-3** (severity ∈ enum) and **I-4**
> (`locators.length >= 1`) as `[contract]` and prescribes asserting them "in the finding
> constructor", while the production code builds findings as bare object literals with
> **no runtime assertion**. Step 6's contracted-invariant negative control proves the
> **dead contract**: an invalid `severity` is caught only by a downstream test
> expectation, never by a runtime abort. Per stage-review Step 5/6 this is a
> production-code gap → **FAIL routed to `/stage-implement`** (add a `makeFinding`
> factory asserting I-3/I-4 and route both detectors through it; production-only, no
> test edits). Review: `docs/reviews/0023-error-report-tab-phase-1-review-01.md`.
> `retry_count` 0 → 1. Next stage: **implement** (feature-phase 1).
>
> **operator re-plan — UNBLOCKED (2026-06-23):** human chose "re-plan the remaining
> work." Two root causes fixed: (1) the orphaned I-3/I-4 `makeFinding` fix (`d9a720d`,
> lost in the auth-recovery `01d8397`) was **re-applied** on top of the now-shipped 0024
> work → commit **`79dcd45`** (`npm run verify` green, 275 passed); (2) the
> thin-slice-vs-whole-plan-`pbt-floor` mismatch was resolved by **consolidating Phases
> 2-6 into a single Phase 2** (codes 3-22 + full presentation) in
> `docs/plans/0023-error-report-tab.md` — the former phase bodies are preserved verbatim
> as `###` sub-sections, the 12 PBT property rows are unchanged. Phase 1 (codes 1-2) is
> marked DELIVERED. State set to `stage: atdd`, `current_phase: 2`, `total_phases: 2`,
> `status: ready`, flag cleared. The Phase-2 atdd is RED-satisfiable on `79dcd45` (codes
> 3-22 unimplemented) and must front-load all **10** remaining property tests (cumulative
> ≥14 ≥ 12 floor). See `handover-09-replan-p2.md`. **Resume with `bin/backlog-loop`.**
> ⚠️ A residual *strategic* decision remains for the human: the whole-plan `pbt-floor`
> will block any future thin-slice plan the same way — see the handover's "Strategic note".
>
> **atdd p2 done (2026-06-23):** Phase-2 acceptance + property tests committed under
> `tests/acceptance/0023-phase-2-*.test.js` (11 files: 22 acceptance scenarios for codes
> 3-22 + the DC-3 presentation contract, and **10 new `test.prop` properties** — one per
> declared parametric rule). **Stable RED** confirmed across 5 flakiness reruns on the
> pre-impl base (acceptance 5/5 exit 1 = 22 failed; inner 5/5 exit 1 = 9 failed / 2
> intentionally-green). Cumulative committed properties now **12 genuine `test.prop`** (2
> phase-1 + 10 phase-2) ≥ the whole-plan `pbt-floor` of 12. RED logs in
> `docs/atdd-logs/0023-error-report-tab-phase-2-*.log`. Tests target only the named seams
> (`prepareSimulationData(...).findings`, the new `collectRunLevelFindings({...})`,
> `renderErrorReport`, the `#tab-error-report` DOM). No frozen test edited; no production
> code touched. Next stage: **implement** (feature-phase 2) reading `handover-10-atdd-p2.md`.
>
> **atdd p1 re-run — BLOCKED, FLAGGED FOR HUMAN (2026-06-23):** the gate rewound to
> `atdd` on `pbt-floor` (whole-plan floor **12** parametric rules vs **4** committed
> property invocations). But the atdd re-run inherited a **post-implementation** base —
> HEAD `2b3fe7f` carries the phase-1 impl (`d77e0ab`) in its ancestry (note the impl
> the gate examined, `d9a720d` with the I-3/I-4 `makeFinding` fix, is **not** in HEAD's
> ancestry — auth-failure-recovery divergence). So the two **committed** phase-1
> `*-red.log` commands now exit **0 (GREEN)** (acceptance 6/6, inner 7/7), and the gate's
> RED re-check **(c)** — which re-runs those exact commands and requires a non-zero exit —
> rejects **any** atdd commit on this base. atdd cannot edit production code to restore a
> pre-impl RED base, so this is **not** autonomously resolvable: emitted **`blocked`**,
> `stage` left at `atdd`, no tests authored. **Human action** (see
> `handover-08-atdd-p1.md`): reset `index.html` to test commit `36d5b1c` (pre-impl) and
> front-load phase-1 property tests to **≥12** cumulative; **or** re-plan 0023 as a
> single feature-phase; **or** make the pbt-floor per-phase. Evidence:
> `docs/atdd-logs/0023-error-report-tab-phase-1-base-health.log`.
>
> **review (integrity) p2 — PASS (2026-06-23):** integrity is clean for codes 3-22 + the
> presentation contract. Test immutability holds (`git diff 57b38dc..cbbabc6 -- tests
> features e2e acceptance` empty); no test gaming, env branches, suppression tokens, or
> fixture-identity special-casing in the production change (`index.html`, originating in
> `0ea82c9`); all detectors route through the `makeFinding` factory so the I-3/I-4
> `[contract]` assertions are live — **proven** by a contract negative control that fired
> `makeFinding`'s own throw (`[finding] invalid severity "CRITICAL"`). PBT meets the
> whole-plan floor: 10 Phase-2 `test.prop` rows + 2 Phase-1 = **12 ≥ 12**. A behavioral
> negative control on the marquee `MQ_FORWARD_DOUBLE_COUNT` rule (`qSet.size >= 2` → `>= 3`)
> was killed and cleanly reverted. Mutation Step 7 skipped (recorded N/A — ADR-0036).
> **One spec deviation handed to correctness review (not an integrity failure):**
> `LAMBDA_ZERO` is implemented as `lambda===0 && epicSizingDist.length===0` vs the plan's
> `[test-only]` `LAMBDA_ZERO ⇔ lambda===0`; the committed AT-5 presentation test *requires*
> the guard (orphan epic with recognised size ⇒ λ=0 with sizing data; badge asserts `1
> WARNING`). Review: `docs/reviews/0023-error-report-tab-phase-2-review-01.md`.
> `retry_count` unchanged (PASS). Next stage: **review-correctness** (feature-phase 2)
> reading `handover-13-review-p2.md`.
>
> **review-correctness p2 — BLOCKED `suspect-test`, FLAGGED FOR HUMAN (2026-06-23):**
> reasoning from the spec, one correctness deviation survived: `LAMBDA_ZERO` (code 6) is
> guarded `lambda === 0 && epicSizingDist.length === 0`, contradicting the plan's
> `[test-only]` invariant **`LAMBDA_ZERO ⇔ lambda === 0`** + behavioral rule. Because the
> only fatal stop fires when `epicSizingDist.length === 0` (run handler ~5105) *before* the
> report renders (~5171), the guard makes `LAMBDA_ZERO` **structurally unreachable** in any
> rendered report, and it suppresses the warning in a genuinely degenerate completed run
> (in-window orphan Epic with recognised size ⇒ λ=0 with `epicSizingDist=['M']`). The guard
> is wrong — **but** the committed GREEN AT-5 test
> `tests/acceptance/0023-phase-2-acc-presentation.test.js` seeds exactly that orphan scenario
> and asserts the badge `1 WARNING` (ORPHAN_EPIC only), which *requires* the guard.
> Production cannot satisfy **both** the spec and the frozen test (a strict rule yields
> `2 WARNING`), so per `stage-review-correctness` Step 5b this is **`suspect-test`**, not a
> production FAIL — **never routed to `implement`**. All other detectors (codes 3-5, 7, 8-9,
> 10-22) reviewed clean; I-1 holds. Stage/status/current_phase/retry_count left unchanged;
> the loop flags a human. **Human picks:** (1, recommended) drop the guard + migrate AT-5 to
> `2 WARNING` (or re-seed AT-5 so λ>0); or (2) amend the plan invariant away from the strict
> biconditional. Either re-enters via **`/stage-atdd`**. Review:
> `docs/reviews/0023-error-report-tab-phase-2-correctness-01.md`; handover
> `handover-14-review-correctness-p2.md`.
>
> **human fix — UNBLOCKED (2026-06-24):** operator chose **Option 1 (honor the spec)** with
> the **`2 WARNING` badge** treatment of AT-5. The plan invariant `LAMBDA_ZERO ⇔ lambda === 0`
> is **kept unchanged** (a completed λ=0 Run forecasts ~0 work and must WARN). The frozen test
> `tests/acceptance/0023-phase-2-acc-presentation.test.js` (AT-5) was **migrated by the human**
> — badge `'1 WARNING'` → `'2 WARNING'` (ORPHAN_EPIC + LAMBDA_ZERO) + comments — the only edit
> the loop may not make itself. Production is **left untouched** so the slice has a genuine RED
> base: the migrated AT-5 **fails on HEAD** (guard still suppresses LAMBDA_ZERO → `1 WARNING`),
> which `/stage-implement` resolves by dropping the `&& epicSizingDist.length === 0` guard at
> `index.html:2353`. Verified this session: AT-5 RED on HEAD (exit ≠ 0); with the guard
> temporarily dropped `npm run verify` = **308 passed, 1 skipped** then reverted (`git diff
> index.html` empty) — AT-1 and all other detectors unaffected, no LAMBDA_ZERO PBT to satisfy.
> This is **not** the handover-08 post-impl-base trap: there *is* an authentic RED test for the
> slice. State set to `stage: atdd`, `status: ready`, `current_phase: 2`, flag cleared,
> `blocked_reason` cleared. **Resume with `bin/backlog-loop`.** See `handover-15-human-fix-p2.md`.
>
> **atdd p2 re-run (suspect-test RED base) done (2026-06-24):** the human-migrated AT-5
> (`2 WARNING`) is confirmed **stable RED on HEAD `4d57d35`** across 5 flakiness reruns
> (5/5 exit 1, same reason: badge renders `1 WARNING` because the guard at
> `index.html:2353` still suppresses LAMBDA_ZERO when `epicSizingDist` is non-empty). **No
> new test or production code was written** — the human already migrated the one frozen
> test, and per handover-15 no new property is needed (LAMBDA_ZERO is acceptance-level;
> PBT floor 12 ≥ 12 already met). The phase-2 RED logs were **re-scoped to the AT-5
> command** and the now-GREEN stale `…-phase-2-inner-red.log` (`0023-phase-2-prop`, exit 0
> / 11 passed) was **removed** so the gate's RED re-check (c) re-runs only AT-5 (RED).
> Boot smoke: `smoke_command` empty ⇒ minimal index.html parse check (PASS). State set to
> `stage: implement`, `next_handover: handover-16-atdd-p2.md`. **Next stage: implement**
> (feature-phase 2) — drop `&& epicSizingDist.length === 0` from `index.html:2353`.
>
> **implement p2 done (2026-06-24):** the single production line landed —
> `index.html:2353` `if (lambda === 0 && epicSizingDist.length === 0)` → `if (lambda === 0)`
> — restoring `LAMBDA_ZERO ⇔ lambda === 0` (I-2). AT-5 GREEN (badge `2 WARNING`);
> `npm run verify` = 308 passed / 1 skipped (impl commit `6734696`). See
> `handover-17-implement-p2.md`. Next stage: **review** (integrity, feature-phase 2).
>
> **review (integrity) p2 — PASS (2026-06-24):** re-reviewed the narrow
> `056c7b3..6734696` diff (one production line, no test files). Test immutability holds
> (test-path diff empty); no test-gaming patterns (the change *deletes* a special-case
> conjunct — it generalises, not overfits); I-2 satisfied by the literal `if (lambda === 0)`;
> the `[contract]` I-3/I-4 stay PRESENT and **live** in `makeFinding` — proven by a
> contract negative control firing `[finding] invalid severity "CRITICAL" …`. The marquee
> rule's behavioral negative control (re-add the guard ⇒ AT-5 fails `1 WARNING`; revert ⇒
> passes) was killed and cleanly reverted. PBT floor (12) met and unchanged (20 committed
> property invocations); `LAMBDA_ZERO` is acceptance-covered (not a parametric row).
> Mutation Step 7 N/A (recorded — ADR-0036). `npm run verify` green (308 passed). No
> additive tests needed. `retry_count` unchanged (PASS). Review:
> `docs/reviews/0023-error-report-tab-phase-2-review-02.md`; handover
> `handover-18-review-p2.md`. Next stage: **review-correctness** (feature-phase 2) — only
> its PASS advances feature-phase 2 to `done`.
