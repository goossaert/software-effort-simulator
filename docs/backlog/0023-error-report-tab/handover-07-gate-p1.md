---
schema: backlog-handover/v1
task_id: "0023"
produced_by_phase: gate
feature_phase: 1
for_next_phase: atdd
outcome: fail
reason: "12 parametric plan rule(s) require a property test (min 1 each = 12) but the committed tests invoke fc.property|test.prop|it.prop only 4 time(s)"
produced_at: 2026-06-23T05:32:20Z
produced_commit: d9a720d865f31c939262436110bb0d1bc9b9ea08
gate:
  stage: atdd
  failed_check: pbt-floor
  evidence:
    - "12 parametric plan rule(s) require a property test (min 1 each = 12) but the committed tests invoke fc.property|test.prop|it.prop only 4 time(s)"
    - "For any set of in-scope epics, `findings.filter(f=>f.code==='UNRECOGNIZED_SIZE_EPIC')` locates **exactly** the epics whose `normalizeSize(_tshirt_size)` ∉ `{2XS,XS,S,M,L,XL,XL+}`, one finding each, no duplicates.; For any inputs and any fixed seed, the engine stats computed from `prepareSimulationData`'s outputs equal the stats computed when `findings` is discarded (advisory / I-1).; For any epic set, the union of epics flagged `ORPHAN_EPIC` ∪ `EPIC_OUT_OF_SCOPE` equals exactly the set the engine excluded from λ for a scope reason, partitioned (no epic in both).; For any selection, `QUARTER_NO_EPICS` is emitted iff a selected historical quarter has ≥1 initiative and 0 in-scope tagged epics, and its count equals that quarter's initiative count.; For any raw capacity string, `CAPACITY_COERCED` is present iff `(parseFloat(raw); For any raw iterations string, `ITERATIONS_CLAMPED` is present iff the clamped/defaulted value `!==` the entered integer.; For any initiatives, the set of keys flagged `DUP_INITIATIVE_KEY` equals exactly the keys whose normalised form occurs ≥2 times, each with the correct count.; For any hist/target selections, `HIST_TARGET_OVERLAP` lists exactly the quarters in `normalise(hist) ∩ normalise(target)`.; For any epic set, an epic is flagged `DANGLING_EPIC_LINK` iff its `_initiative_key` is non-blank and ∉ the initiative-key set, and `ORPHAN_EPIC` iff blank — never both, never neither-when-it-should.; For any constant-work rows, `CONSTANT_WORK_EXCLUDED.impact` PM/rows equal `getConstantWorkExcluded`'s `pm`/`rows` for the target quarters.; For any multiset of findings, `renderErrorReport` emits them in `ERROR`→`WARNING`→`INFO` order (then by `code`, then first-locator id), grouped by category, and the badge counts match.; For any target-quarter rows, `MQ_FORWARD_DOUBLE_COUNT` flags exactly the initiative keys whose normalised key appears in ≥2 distinct selected target quarters, and the engine's `kPerGroup` is unchanged by the presence of the finding (I-1)."
---
## Summary
The post-stage gate rejected the atdd commit for feature-phase 1: 12 parametric plan rule(s) require a property test (min 1 each = 12) but the committed tests invoke fc.property|test.prop|it.prop only 4 time(s).

## Instructions for the next phase
Re-run atdd and resolve the failed sub-check (pbt-floor). Apply production-only fixes; do NOT edit the committed tests.
Evidence: For any set of in-scope epics, `findings.filter(f=>f.code==='UNRECOGNIZED_SIZE_EPIC')` locates **exactly** the epics whose `normalizeSize(_tshirt_size)` ∉ `{2XS,XS,S,M,L,XL,XL+}`, one finding each, no duplicates.; For any inputs and any fixed seed, the engine stats computed from `prepareSimulationData`'s outputs equal the stats computed when `findings` is discarded (advisory / I-1).; For any epic set, the union of epics flagged `ORPHAN_EPIC` ∪ `EPIC_OUT_OF_SCOPE` equals exactly the set the engine excluded from λ for a scope reason, partitioned (no epic in both).; For any selection, `QUARTER_NO_EPICS` is emitted iff a selected historical quarter has ≥1 initiative and 0 in-scope tagged epics, and its count equals that quarter's initiative count.; For any raw capacity string, `CAPACITY_COERCED` is present iff `(parseFloat(raw); For any raw iterations string, `ITERATIONS_CLAMPED` is present iff the clamped/defaulted value `!==` the entered integer.; For any initiatives, the set of keys flagged `DUP_INITIATIVE_KEY` equals exactly the keys whose normalised form occurs ≥2 times, each with the correct count.; For any hist/target selections, `HIST_TARGET_OVERLAP` lists exactly the quarters in `normalise(hist) ∩ normalise(target)`.; For any epic set, an epic is flagged `DANGLING_EPIC_LINK` iff its `_initiative_key` is non-blank and ∉ the initiative-key set, and `ORPHAN_EPIC` iff blank — never both, never neither-when-it-should.; For any constant-work rows, `CONSTANT_WORK_EXCLUDED.impact` PM/rows equal `getConstantWorkExcluded`'s `pm`/`rows` for the target quarters.; For any multiset of findings, `renderErrorReport` emits them in `ERROR`→`WARNING`→`INFO` order (then by `code`, then first-locator id), grouped by category, and the badge counts match.; For any target-quarter rows, `MQ_FORWARD_DOUBLE_COUNT` flags exactly the initiative keys whose normalised key appears in ≥2 distinct selected target quarters, and the engine's `kPerGroup` is unchanged by the presence of the finding (I-1).

## Definition of done
The re-run commit passes the pbt-floor gate sub-check that failed here.
