---
schema: backlog-handover/v1
task_id: "0023"
produced_by_phase: apply-docs
feature_phase: null
for_next_phase: plan
outcome: success
reason: ""
produced_at: 2026-06-22T19:17:18Z
produced_commit: 6124c733df083b888973b9933677c6be63deabd5
toolchain_applied: already-selected
---
## Summary

apply-docs applied the documentation grill prepared for task 0023. The five glossary
terms the acceptance criteria depend on are now in repo-root `CONTEXT.md` (four newly
added — **Error Report**, **Data-quality finding**, **Severity**, **In-scope epic /
Out-of-scope epic** — plus the **pre-existing** **Recognised t-shirt size** entry
augmented in place rather than duplicated), and `docs/adr/0037-error-report-advisory-diagnostics.md`
was created verbatim from the handover. The mechanical toolchain was already selected
(`toolchain.selected: true`), so Step 3b was an idempotent no-op recorded as
`toolchain_applied: already-selected`. The task is advanced to `stage: plan`.

## Instructions for the next phase (plan)

1. Read this handover plus the **grill** handover (`handover-01-grill.md`) — that file
   carries the authoritative **Plan logistics**: slug, user-visible goal, out-of-scope,
   entry point, relevant files/anchors, the **lint-cleared AC-1…AC-13**, the
   author-asserted **I-1…I-5**, and the **decision constraints DC-1…DC-5**.
2. Formalise the `DC-n` constraints (and ADR-0037) into the plan's
   Data-models / identifiers / entry-point / out-of-scope sections — **do not re-decide
   them** (the four foundational decisions are settled: instrument the Run path;
   advisory-only; report the multi-quarter forward double-count at `ERROR` without
   changing engine math; report covers completed/non-fatal Runs only).
3. Set the authoritative `total_phases: N` and `current_phase: 1` and write
   `handover-NN-plan.md` advancing `stage: atdd` (LOOP-MODE.md index-advance table).
   The grill phase-count **hint** is ~4 (non-authoritative; the plan owns the real count).
4. Cite the glossary terms and ADRs that now exist (below) rather than re-deriving them.

## Files the next phase MUST read

- `docs/backlog/0023-error-report-tab/handover-01-grill.md` — the **Plan logistics**:
  AC-1…AC-13, I-1…I-5, DC-1…DC-5, suggested test-facing `code`s, entry point, anchors.
- `CONTEXT.md` — the glossary, now including **Error Report**, **Data-quality finding**,
  **Severity**, **In-scope epic / Out-of-scope epic**, and the augmented **Recognised
  t-shirt size**; the plan's behavioural rules must use these exact terms.
- `docs/adr/0037-error-report-advisory-diagnostics.md` — the instrument-the-Run-path +
  advisory-only decision and its consequences (the spec the plan formalises).
- `docs/adr/0018-tab-based-results-layout.md` — the tab convention (`data-tab` slug +
  `#tab-<slug>` panel, pre-rendered during the Run, org as the resting tab) DC-1 follows.
- `docs/adr/0002-client-side-only.md` — no backend / no persistence constraint (DC-2).
- `index.html` — the single-file app; the silent-drop / coercion sites named in the
  grill handover's "relevant files/dirs" are where each finding is instrumented
  (line numbers are approximate — re-confirm at plan time, the file evolves).

## Context the next phase needs

Glossary terms that now exist in `CONTEXT.md` (so `plan` cites, never re-derives):
- **Error Report** — the seventh **Tab** (`#tab-error-report`, slug `error-report`,
  last in the bar); advisory, post-Run, never persisted; org stays the resting tab.
- **Data-quality finding** — `{ code, severity, locators, impact, message }`-shaped
  issue surfaced in the report; collected by instrumenting the Run path.
- **Severity** — `ERROR` | `WARNING` | `INFO`; report sorted `ERROR` → `WARNING` → `INFO`.
- **In-scope epic / Out-of-scope epic** — the λ-calibration scope rule; out-of-scope and
  orphan epics are surfaced as findings.
- **Recognised t-shirt size** — already existed; augmented with the
  unrecognised → `0` PM / excluded-from-λ-and-Bootstrap-pool consequence AC-3/AC-4 use.

ADR that now exists: **ADR-0037** (`docs/adr/0037-error-report-advisory-diagnostics.md`),
re-derived as the next free number against `docs/adr/` (last was 0036) — matches the
number grill proposed.

Autonomous decisions taken this phase (no user; recorded per LOOP-MODE.md):
1. **House-style adaptation.** The grill handover's prose described the glossary house
   style as "bold term + em-dash + definition" and wrote the five entries as
   `>`-blockquotes. The actual `CONTEXT.md` house style is `**Term**:` on its own line,
   then the definition, then an `_Avoid_:` synonym line. I applied the prepared
   **content** in the file's real house style (added an `_Avoid_:` line to each, linked
   ADR-0037 as a Markdown link, bolded glossary cross-references) — honouring the
   handover's own instruction #1 to "match the surrounding glossary house style". No
   definition meaning was changed; this is formatting only.
2. **De-duplication of "Recognised t-shirt size".** That term **already existed**
   (`CONTEXT.md`, "Column detection" section) with a precise definition. Per the skill's
   "check for an existing file that already covers it — update rather than duplicate"
   rule, I augmented the existing entry in place with the missing consequence
   (unrecognised size → `0` PM, excluded from λ and the **Bootstrap pool**; constant
   work → `0` PM), instead of adding a second, conflicting entry. The grill version's
   simplified wording ("one of the seven canonical labels…") was not added verbatim
   because the existing entry already states the equivalent (recognised = key in the
   active parameter table, key sets equal by invariant).
3. **Glossary internal-consistency edits (not in the prepared list, low-risk,
   reversible).** Because a seventh tab term was added, the existing **Tab** entry was
   updated from "six named views" → "seven named views", **Error Report** appended to
   its enumeration, and "the other three are read-only" → "the other four are read-only"
   (the new tab is read-only). The `index.md` body's stale "See ADR-0037 (to be created
   by apply-docs)" was changed to a live link now that the ADR exists.

Toolchain: **no-op**. `backlog.config.json` has `toolchain.selected: true` (selected
2026-06-21), so Step 3b installed/changed nothing; `toolchain_applied: already-selected`.

Boot smoke: **passed (no-op)**. `smoke_command` is empty (logged no-op per LOOP-MODE.md);
the minimal base check confirmed `index.html` is present (4641 lines) and the working
tree was clean. apply-docs touches only docs + `CONTEXT.md` + backlog files, so the
build/boot state of the single-file app is unaffected.

## Definition of done (for plan)

- A `docs/plans/0023-error-report-tab.md` exists with behavioural rules / invariants /
  forbidden shortcuts derived from AC-1…AC-13, I-1…I-5, DC-1…DC-5 and ADR-0037, using
  the glossary terms above.
- `index.md` advanced to `stage: atdd` with authoritative `total_phases: N`,
  `current_phase: 1`, and a `handover-NN-plan.md` written for the first atdd cycle.
