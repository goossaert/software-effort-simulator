---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: implement
feature_phase: 1
for_next_phase: review
outcome: success
reason: ""
produced_at: 2026-05-31T20:38:35Z
produced_commit: ""
---
## Summary

Implemented feature 0021 **Phase 1** — the `editedConstantWork` substrate
(transparent indirection, ADR-0034) — entirely inline in `index.html`. A new
module-scoped `let editedConstantWork = null;` sits beside `parsedConstantWork`;
`loadConstantWorkCSV` now builds it as a per-row shallow clone
(`parsedConstantWork.map(r => ({ ...r }))`); `resetConstantWorkFile` nulls both
arrays; and the three production constant-work readers (`getConstantWorkEffort`,
`getConstantWorkEpics`, and `buildTeamProjections`' `cwQuarters` derivation) now
read `editedConstantWork`. `parsedConstantWork` is retained untouched as the
immutable parse output / Phase 6 datalist option-pool substrate. The targeted
run is GREEN (39/39) and `npm run verify` exits 0 (160 passed / 1 skipped). No
test file was edited; the diff is `index.html`-only.

## Instructions for the next phase

`review` (feature-phase **1**):

1. Derive the diff range from git log (each phase is one atomic commit):
   - test commit: `git log -1 --format=%H -- docs/backlog/0021-constant-work-tab-and-group-scoping/handover-04-atdd-p1.md`
   - impl commit: `git log -1 --format=%H -- docs/backlog/0021-constant-work-tab-and-group-scoping/handover-05-implement-p1.md`
   Review `test_commit..impl_commit`.
2. Verify the implementation honours the plan's Phase 1 **behavioral rule**,
   **invariants**, **counterexamples**, and **forbidden shortcuts** (plan
   lines ~348-374). Specifically check the counterexamples did NOT happen:
   no deep clone (`JSON.parse(JSON.stringify(...))`), no `slice()` reference
   sharing, no lazy/first-edit clone, no reader left on `parsedConstantWork`,
   `resetConstantWorkFile` nulls **both** arrays, and no defensive re-clone
   inside a reader.
3. Confirm the diff touches **only** `index.html` (substrate binding + clone +
   null + the three reader migrations) and that no datalist / option-pool read
   was migrated (none exist yet — Phase 6). Confirm no test file drifted.
4. Re-run the verification yourself: targeted
   `npx vitest run tests/acceptance/phase-1-constant-work-substrate.test.js tests/acceptance/phase-1-engine.test.js`
   and full `npm run verify` — both must exit 0.

## Files the next phase MUST read

- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — **Phase 1** slice (lines ~254-396): behavioral rule, invariants, counterexamples, forbidden shortcuts, definition of done. The contract to verify against.
- `index.html` — the implementation. Changed sites: `editedConstantWork` declaration (~`1559-1560`), `resetConstantWorkFile` (~`1734`), `loadConstantWorkCSV` clone (~`1744-1746`), `getConstantWorkEffort` (~`1752-1764`), `getConstantWorkEpics` (~`1770-1789`), `buildTeamProjections`' `cwQuarters` (~`2109-2114`).
- `tests/acceptance/phase-1-constant-work-substrate.test.js` — AT-1…AT-9, the frozen acceptance tests (read to understand the seam contract; do NOT edit).
- `tests/acceptance/phase-1-engine.test.js` — the migrated AT-21/AT-27 (frozen). Other ATs here are unaffected by Phase 1 and stay green.
- `docs/backlog/0021-constant-work-tab-and-group-scoping/handover-04-atdd-p1.md` — the atdd handover (the RED-gate record + the seam decisions).
- `docs/adr/0034-editable-constant-work-tab.md` — the `editedConstantWork` substrate rationale and the parsed/edited two-array split.
- `.agent/last-verify.log` — the full `npm run verify` output from this session (not committed; regenerate by re-running verify).

## Context the next phase needs

Autonomous decisions taken this session (Loop mode — no user to gate Step 4 seam
conflicts or Step 7 verify ambiguity):

- **No seam conflict (Step 4).** The test-imposed API is exactly the plan's seam
  set: the `editedConstantWork` binding, the `loadConstantWorkCSV` clone /
  `resetConstantWorkFile` null lifecycle, and the three named readers. Nothing
  new was invented; no naming collision with existing conventions. The clone
  idiom matches `editedInitiatives` (`index.html:1570`) verbatim. Proceeded
  without a test-refactor phase.
- **Clone form.** Used `parsedConstantWork.map(r => ({ ...r }))` — the exact
  per-row shallow clone the plan names and that `editedInitiatives` uses. This
  preserves key order (AT-1) and per-row reference independence (AT-2), and
  avoids all three counterexample clone shapes (deep clone / `slice` / lazy).
- **Reader migration is total but scoped.** All three *production* readers now
  name `editedConstantWork` and none names `parsedConstantWork`. The remaining
  `parsedConstantWork` references are only: the declaration, the parse in
  `loadConstantWorkCSV`, its `console.log`, and the null in
  `resetConstantWorkFile` — i.e. the substrate lifecycle, never a read of
  constant-work rows for the simulation. No option-pool/datalist read was
  migrated (none exists pre-Phase-6).
- **Forbidden-patterns self-check:** no fixture literals/IDs in production, no
  `NODE_ENV`/test-env branches, no imports from `tests/`. The implementation is
  the general substrate rule; the tests pass as a consequence.

## Verification evidence

- Targeted: `npx vitest run tests/acceptance/phase-1-constant-work-substrate.test.js tests/acceptance/phase-1-engine.test.js` → exit **0**, **39 passed** (2 files: 9 substrate + 30 engine).
- Full: `npm run verify` (`vitest run`) → exit **0**, **160 passed | 1 skipped** (10 files; the 1 skip is the engine-mean sanity check that self-skips when CSV fixtures are absent, per commit `88b0416` — pre-existing, unrelated). Full log in `.agent/last-verify.log`.
- Drift: `git diff --cached --name-only -- tests features e2e acceptance` empty at commit time — no test file staged. The implement commit's `git diff` touches only `index.html` + this task's backlog docs (index.md + this handover).

## Definition of done (for review)

- The diff implements the Phase 1 behavioral rule (per-row shallow-clone
  substrate; three readers migrated; both arrays nulled on reset) with no
  counterexample or forbidden shortcut present.
- No test gaming / overfitting: production logic is the general substrate rule,
  not fixture-keyed.
- Targeted tests and `npm run verify` both exit 0 when review re-runs them.
- No test file drifted between `test_commit` and `impl_commit`.
- On PASS, advance to Phase 2 atdd (`current_phase: 2`, `stage: atdd`,
  `next_handover` → the plan handover); on FAIL, write the findings and bounce
  back to implement.
