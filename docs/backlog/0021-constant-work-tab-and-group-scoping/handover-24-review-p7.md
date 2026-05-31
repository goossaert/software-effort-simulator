---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: review
feature_phase: 7
for_next_phase: atdd
outcome: success
reason: ""
produced_at: 2026-05-31T23:35:49Z
produced_commit: ""
test_commit: be17a606900872d897e309ef995c416aa7a00442
impl_commit: 942b45888837d2d700e7ad1fd71370b5a8cb0903
---
## Summary

Reviewed feature 0021 **Phase 7** — **Add row / delete row / from-scratch authoring** on the
**Constant work tab** (the ADR-0034 delta). Verdict **PASS**. Independent verification of the diff
`be17a60..942b458` (`index.html`-only) confirms the general rule is implemented, all 5 invariants
hold by construction, none of the 4 counterexamples is realizable, and no test file drifted across
`test_commit..impl_commit`. Targeted suite **11/11** (exit 0); `npm run verify` **215 passed /
1 skipped** (exit 0). Three negative-control mutations each flipped exactly the predicted AT(s) to
RED and reverted to GREEN. Review file:
`docs/reviews/0021-constant-work-tab-and-group-scoping-phase-7-review-01.md`.

## Instructions for the next phase

`atdd` (feature-phase **8**) — author the frozen acceptance/inner tests for the plan's **Phase 8**
slice (`## Phase 8`, line 1182: **Groups Members popover lists initiatives ∪ constant-work
Categories (merge)**), then confirm the RED gate. Read the plan's Phase 8 slice and the relevant
prior tests/handovers first. This is a fresh `atdd→implement→review` cycle; the test commit for
Phase 8 will be this atdd handover.

## Files the next phase MUST read

- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — the **Phase 8** slice (`## Phase 8`,
  line 1182): acceptance behavior, behavioral rule, invariants, counterexamples, forbidden
  shortcuts, RED gate, DoD. THE CONTRACT.
- `docs/adr/0034-editable-constant-work-tab.md` and `docs/adr/0028-category-as-generalized-moscow.md`
  — the Category/membership and (Blank)-sentinel semantics the merge surfaces.
- `index.html` — the Groups tab Members popover render path (the merge consumes
  `editedInitiatives ∪ editedConstantWork` Categories, mirroring the Phase-6/`_cwObservedValues`
  union idiom at ~`index.html:3667`).
- `tests/acceptance/phase-2-groups-tab.test.js` — the Groups-tab seam idioms (tab reveal via the
  generic tab-switch handler, popover open via `.click()`), reusable for Phase 8.

## Context the next phase needs

Phase 7 is fully GREEN and verified — no carry-over fixes. The Phase-7 production surface (the
`+ Add row` toolbar control, the per-row `deleteConstantWorkRow`, `addConstantWorkRow`, and the
`CW_CANONICAL_SCHEMA` constant) is settled and Phase 8 should not need to touch it. The
`_cwObservedValues` helper (`index.html:3671`) already computes the observed-Category union across
`editedInitiatives ∪ editedConstantWork` — Phase 8's Members-popover merge is the same union shape
and may reuse it.

**Review decisions (autonomous, no user in Loop mode):**

- **Verdict PASS** on the basis that the diff implements the general ADR-0034 rule keyed on the
  structural predicate `parsedConstantWork === null` (not on fixture values), with `CW_CANONICAL_SCHEMA`
  being the plan's documented contract rather than a test literal.
- **Negative controls run and reverted before commit** (the commit contains only the review file,
  the index advance, and this handover): (a) `addConstantWorkRow` gated behind `parsedConstantWork`
  → 8 of 11 fail (every from-scratch `it`); (b) `addConstantWorkRow` always `CW_CANONICAL_SCHEMA`
  → AT-2 fails; (c) `confirm()` added to `deleteConstantWorkRow` → AT-3 fails. Each reverted →
  11/11 GREEN, working tree clean.
- **One non-blocking observation (not a FAIL):** the `parsedConstantWork[0]` fallback in
  `addConstantWorkRow` (imported → all rows deleted → `+ Add row`) is not directly exercised by a
  test, but is robust by construction and is not a plan counterexample. No action required.

## Definition of done

For the consuming `atdd` (Phase 8): the acceptance file is authored and frozen, the RED gate is
confirmed (tests fail on the post-Phase-7 build for the documented reasons), RED logs are written,
and the index advances `stage: implement` for Phase 8.
