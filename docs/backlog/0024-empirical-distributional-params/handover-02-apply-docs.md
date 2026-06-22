---
schema: backlog-handover/v1
task_id: "0024"
produced_by_phase: apply-docs
feature_phase: null
for_next_phase: plan
outcome: success
reason: ""
produced_at: 2026-06-22T20:09:49Z
produced_commit: a3785ef26de3a4fe944ef23c49039e7532437f14
---
## Summary

apply-docs applied the documentation grill prepared for task 0024 and advanced it to
`stage: plan`. Two glossary entries — **Empirical (distributional) parameters** and
**Ratio residual pool** — were added to repo-root `CONTEXT.md` (in house style,
immediately after the **Empirical parameters** entry). `docs/adr/0038-empirical-distributional-parameters-mode.md`
was created with the full ADR text. The ADR-0026 supersession banner was extended with
the ADR-0038 blockquote (the "carry synthetic `(μ, σ)` through for `2XS`/`XL`/`XL+`"
decision is replaced by the pooled grand-mean centre **in the new mode only**). The
mechanical toolchain was already selected (`toolchain.selected: true`), so Step 3b was an
idempotent no-op (`toolchain_applied: "already-selected"`). No code, tests, or config were
touched.

The ADR number was re-derived at write time against `docs/adr/`: the highest existing was
`0037` (`error-report-advisory-diagnostics`, task 0023, now applied), so `0038` is the next
free number — matching grill's proposal, no collision.

## Instructions for the next phase (plan)

1. Read `handover-01-grill.md` for the **## Plan logistics** — it carries the user-visible
   goal, out-of-scope list, entry point + code anchors, the baked constants
   (`T_SHIRT_PARAMS_DISTRIBUTIONAL` + `RATIO_RESIDUALS`), and the lint-cleared
   **AC-1..8 / I-1..4 / DC-1..4**. Formalise the `DC-n` one-way doors into the plan's
   identifiers / entry-point / reproducibility sections — do **not** re-decide them.
2. Set the authoritative `total_phases` (grill's hint is ~2: (1) the two baked constants +
   the third-table/active-sampler mechanism + the residual-multiplying sampler path, gated
   so the other two modes' values **and** PRNG stream are untouched; (2) the radio UI +
   `change` handler + `.active` toggle + ephemeral reset + constant-work-follows-the-table
   wiring). Plan sets the real number.
3. Cite the now-existing glossary terms and ADR-0038 rather than re-deriving them.
4. The single highest-risk constraint is **DC-2 / I-1** (PRNG isolation): the residual
   multiply and its extra RNG draw must occur **only** in the new mode. Plan must preserve
   the bit-for-bit reproducibility (sampled values **and** PRNG draw sequence) of the
   Synthetic and Empirical modes — the function-pointer `activeSampler` swap is the
   recommended mechanism (AC-4 / I-1).
5. Use the baked constants from `handover-01-grill.md` **verbatim** — do not recompute (the
   source CSV is not in the repo; DC-3).

## Files the next phase MUST read

- `docs/backlog/0024-empirical-distributional-params/handover-01-grill.md` — the **Plan
  logistics**: goal, scope, entry point/anchors, baked constants, and the lint-cleared
  AC-* / I-* / DC-* the plan formalises.
- `CONTEXT.md` — now carries the two new glossary entries (**Empirical (distributional)
  parameters**, **Ratio residual pool**); the plan cites these terms.
- `docs/adr/0038-empirical-distributional-parameters-mode.md` — the nine decisions, the
  consequences, and the rejected alternatives the plan must honour (esp. decision 7 =
  PRNG isolation, decision 4 = uncalibrated-size 1.40× centre, decision 3 = calibrated
  centres = empirical).
- `docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md` — the two-table /
  `activeParams` / μ-shift-only / σ-preserving / carry-through decisions this mode builds on
  and partly supersedes (now carrying the ADR-0038 banner).
- `docs/adr/0035-default-to-empirical-lognormal-parameters.md` — the empirical default (must
  stay; DC-4).
- `docs/adr/0009-custom-seeded-prng.md` — the seeded PRNG that makes the AC-4 / I-1
  bit-for-bit reproducibility test writable.
- `docs/adr/0007-lognormal-effort-distribution.md` — the synthetic `(μ, σ)` derivation the
  distributional base + the uncalibrated `ln(1.40)` shift build on.
- `docs/reports/report-rcf-improvements.md` — §2 "Option 1c" + the 2026-06-22 Addendum:
  the full design, the shrinkage formula, the worked numbers, and the extremes caveat.
- `index.html` — the single-file app; grill's anchors (re-confirm line numbers at HEAD)
  locate the synthetic/empirical tables, `activeParams`, `sampleLognormal`,
  `bootstrapChoice`, the `runScenario` hot loop, the radio markup, and the `change` handler.

## Context the next phase needs

- **Glossary terms now defined** (cite, don't re-derive): **Empirical (distributional)
  parameters** and **Ratio residual pool** in `CONTEXT.md`, both immediately after the
  **Empirical parameters** entry.
- **ADR now in effect:** `docs/adr/0038-empirical-distributional-parameters-mode.md`
  (status: accepted; supersedes in part ADR-0026's uncalibrated-size carry-through for the
  new mode only). ADR-0026 now opens with both the ADR-0035 and the new ADR-0038
  supersession blockquotes; ADR-0035's empirical default and ADR-0026's two-table /
  ephemeral / μ-shift-only decisions all still stand.
- **Decisions are settled, not open** — the five grill decisions (raw ratios provided;
  Done-only + drop-outlier recipe; calibrated centres = empirical; label/value
  `empirical-distributional`; baked constants + bit-for-bit reproducibility of the other two
  modes) live in ADR-0038 + DC-1..4. Plan honours them.
- **Boot smoke:** `smoke_command` is empty in `backlog.config.json` ⇒ logged no-op; this was
  a docs-only phase on a clean working tree at the grill commit. Result: **passed** (nothing
  to build/boot; base healthy).
- **Toolchain:** already selected (`toolchain.selected: true`); Step 3b was an idempotent
  no-op, nothing installed or changed.
- **No gated decision required re-deciding.** Every fork was pre-aligned by grill (DC-1..4 /
  ADR-0038); apply-docs took no autonomous one-way-door decision and hit no unaligned
  irreversible fork.
- **Numbering:** task id 0024, ADR 0038 (both author-chosen at grill to avoid the in-flight
  0023 / ADR-0037 `error-report-tab` collision); 0037 is now applied, so 0038 was confirmed
  free at write time.

## Definition of done (for plan)

- `docs/plans/0024-empirical-distributional-params.md` exists with behavioral rules,
  invariants, counterexamples, the per-phase Definition of done, and the Properties /
  invariants to PBT — built from the lint-cleared AC-* / I-* / DC-* and the baked constants.
- `index.md` advanced to `stage: atdd` with `total_phases: N` (authoritative) and
  `current_phase: 1`, and a `handover-NN-plan.md` written for the first atdd cycle.
