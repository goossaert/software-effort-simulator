---
schema: backlog-handover/v1
task_id: "0022"
produced_by_phase: gate
feature_phase: 1
for_next_phase: implement
outcome: fail
reason: "verify_command exited 127 on rerun 1/3 of a fresh checkout"
produced_at: 2026-06-21T18:14:24Z
produced_commit: 165edeee54c633c95dedfea9ea417709f6597bdf
gate:
  stage: implement
  failed_check: hermetic-verify
  evidence:
    - "verify_command exited 127 on rerun 1/3 of a fresh checkout"
    - "20260621_200627_0022_implement_p1.log.gate (commit 165edeee54c633c95dedfea9ea417709f6597bdf)"
---
## Summary
The post-stage gate rejected the implement commit for feature-phase 1: verify_command exited 127 on rerun 1/3 of a fresh checkout.

## Instructions for the next phase
Re-run implement and resolve the failed sub-check (hermetic-verify). Apply production-only fixes; do NOT edit the committed tests.
Evidence: 20260621_200627_0022_implement_p1.log.gate (commit 165edeee54c633c95dedfea9ea417709f6597bdf)

## Definition of done
The re-run commit passes the hermetic-verify gate sub-check that failed here.
