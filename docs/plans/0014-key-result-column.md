# Feature: Key Result (KR) column — header-variant detection and conditional Team Projections matrix column

Created at: 2026-05-21T00:00:00Z

## Context

This feature adds the optional **Key Result** axis to the **Initiatives CSV** and surfaces it as a conditional column in the **Initiative matrix** inside each **Projection section** of the **Team Projections tab**. It owns two narrow things: (a) the `detectKrCol(rows)` function (`index.html:1436-1450`) — a header-variants detector that returns either the matched header name or `null` when no KR column is present, and (b) the `hasKr` gate inside `renderTeamProjections` (`index.html:2615`, `2624`, `2684`, `2692`, `2698`) that adds the KR column to a section's matrix only when at least one initiative in that section has a non-empty `kr` value.

The feature is deliberately narrow. It does not touch the Monte Carlo engine, the **Poisson λ** fit, the **Bootstrap pool**, the **Stats** table, or any chart — `kr` is *display-only* (see [ADR-0022](../adr/0022-optional-key-result-column.md)). It does not introduce a new sidebar control, a new tab, a new file input, or any UI affordance beyond the conditional column in the matrix. It does not touch the **Quarter selector**, the **Capacity** input, the marker system, or the Initiatives tab's editing surface. Where [feature 0002](./0002-content-based-column-detection.md) and [feature 0013](./0013-sensible-csv-format-support.md) own the **Content scan** / **Detection fallback** family of detectors, this feature *adds a sibling* detector whose strategy is intentionally different (header variants only, no content scan, `null`-returning) and documents *why* in [ADR-0022](../adr/0022-optional-key-result-column.md). Where [feature 0012](./0012-team-projections-tab.md) owns the **Team Projections tab** and the **Initiative matrix** structure, this feature *adds one optional column* to the matrix without changing the rest of the section's render.

Relevant cross-cutting decisions:
- [ADR-0001 — Single-file HTML app, no build step](../adr/0001-single-file-html-app.md). The detector and the matrix column live as inline code in `index.html`.
- [ADR-0002 — Client-side only](../adr/0002-client-side-only.md). The KR value is whatever the user's CSV carries; no external resolution.
- [ADR-0003 — CSV as the input format](../adr/0003-csv-input-format.md). The KR column is yet another header convention the simulator accepts as-is.
- [ADR-0005 — Content-based column detection over header-name matching](../adr/0005-content-based-column-detection.md). The KR column is the documented exception — there is no content fingerprint for a Key Result, so the detector falls back to header variants. See [ADR-0022](../adr/0022-optional-key-result-column.md) for the trade-off.
- [ADR-0020 — Cross-quarter Team Projections tab with quick projection Monte Carlo](../adr/0020-team-projections-cross-quarter-view.md). The **Initiative matrix** lives inside each **Projection section**; this feature appends one optional column to that matrix.
- [ADR-0021 — Direct header-name matching for the Sensible format alongside content-scan detection](../adr/0021-sensible-csv-format-dual-support.md). The KR column is uniform across both **Sensible format** and **Quirky format** — it has no per-format branch.
- [ADR-0022 — Optional Key Result column: header-variant detection, conditional rendering, display-only role](../adr/0022-optional-key-result-column.md). The architectural decision for *why* this feature exists in the shape it does (header variants, `null` return, conditional render, display-only).

Glossary terms used below: **Key Result**, **Initiatives CSV**, **Initiative**, **Initiative matrix**, **Projection section**, **Team Projections tab**, **Column detector**, **Content scan**, **Detection fallback**, **Column-detection debug**, **Sensible format**, **Quirky format**, **Constant work**, **Constant Work CSV**, **Run** (see [CONTEXT.md](../../CONTEXT.md)).

## User-visible behavior

A user who uploads an **Initiatives CSV** that includes a Key Result column — under any of the canonical header variants `key_result`, `kr`, `key result`, `keyresult`, `key_results` (case-sensitive primary match, case-insensitive fallback) — presses **Run Simulation** and clicks the `Team Projections` tab. Inside each **Projection section** whose initiatives carry at least one non-empty KR value, the **Initiative matrix** now has a third column between `Jira Key` and `Initiative Name` labelled `KR`. Each initiative row shows its KR value in indigo bold (e.g. `KR-7` or `Activation +10%`); rows whose KR cell is empty in the CSV show a grey em-dash (`—`). Constant-work rows (see [feature 0015](../../backtracked-features.md#0015)) participate in the same gate: their KR — read from `key_result | KR | kr` in the **Constant Work CSV** — counts toward the section's `hasKr` decision and renders in the column when present.

A user who uploads an Initiatives CSV with *no* KR column header (or all-empty KR cells across the team in question) sees the **Initiative matrix** render *without* the KR column. The matrix header has `Jira Key | Initiative Name | Q? YYYY | Q? YYYY | ...`; every footer row's `<td colspan>` reduces from `3` to `2`; the table is narrower by exactly one column. The user reads no missing-data placeholder — the column is simply absent, signalling "this team's roadmap is not tagged to KRs". The **Column-detection debug** panel surfaces the choice: `krCol: "key_result"` (or whichever header variant matched) when a column was detected, `krCol: null` when none was found.

A user who uploads a CSV with a KR column populated for some teams but not others sees per-team granularity: the `Platform` section's matrix may have a KR column while the `Risk` section's matrix does not. The decision is per-section (per-`hasKr` evaluation), not per-CSV — `detectedCols.krCol` being non-`null` is necessary but not sufficient to render the column.

A user who renames their CSV's KR header from `Key_Result` (mixed case) to `key_result` (lowercase Sensible-format style) and re-uploads sees the same column detected, via the case-insensitive fallback path on the first upload and the exact-match path on the second. The matrix renders identically in both cases. The debug panel shows the *raw-case* header name selected, so the user can spot whether the case-insensitive fallback fired.

There is no new UI control. The feature has no sidebar field, no checkbox, no toggle. The user never tells the simulator whether their CSV has a KR column — the detector finds out.

## Scope

### In scope
- `detectKrCol(rows)` (`index.html:1436-1450`):
  - Empty-rows return: `null`.
  - Exact-match pass: walks the variants `['key_result', 'kr', 'key result', 'keyresult', 'key_results']` in order; the first variant present in `Object.keys(rows[0])` wins and the variant's literal string is returned.
  - Case-insensitive fallback: when the exact-match pass finds nothing, lowercase the parsed headers once and walk the same variants list; on hit, return the *raw-case* header (the entry from `Object.keys(rows[0])` at the matching index), not the lowercased variant.
  - Final return: `null` when no exact and no case-insensitive match is found. The detector never fabricates a header name.
- The integration in `loadInitiativesCSV` (`index.html:1510-1512`): `const krCol = detectKrCol(parsedInitiatives);` plus the spread into `detectedCols = { ..., krCol }`. `krCol` is included in the single `console.log` line (`index.html:1513`).
- The per-initiative `kr` field assembled in `buildTeamProjections` (`index.html:1964`): `kr: krCol ? (r[krCol] || '').trim() : ''`. When `krCol === null`, every initiative's `kr === ''` and no row reads from a non-existent header.
- The `hasKr` gate in `renderTeamProjections` (`index.html:2615`): `const hasKr = allInits.some(i => i.kr);` — `allInits` is the flat union of every quarter's `byQuarter[q].initiatives` for the section, *including constant-work rows* (which carry their own `kr` via `getConstantWorkEpics`, `index.html:1680`).
- The conditional KR `<td>` per initiative row (`index.html:2623-2625`): when `hasKr === true`, emit `<td class="kr-col" style="white-space:nowrap;font-size:11px;color:#6366f1;font-weight:600">${i.kr || '—'}</td>`; when `hasKr === false`, emit nothing (the variable is the empty string).
- The conditional KR `<th>` in the matrix header (`index.html:2684`): `${hasKr ? '<th style="width:60px">KR</th>' : ''}`.
- The `colspan` adjustment on both `<tfoot>` rows (`index.html:2692`, `2698`): `<td colspan="${hasKr ? 3 : 2}" ...>`.
- The constant-work KR read inside `getConstantWorkEpics` (`index.html:1680`): `kr: (r.key_result || r.KR || r.kr || '').trim()`. This is a *parallel* path against a *fixed* schema — see [ADR-0022](../adr/0022-optional-key-result-column.md) for why the lookup list differs from `detectKrCol`'s.
- The `krCol` entry in the `detectedCols` shape: a sixth key alongside `initKeyCol`, `moscowCol`, `teamCol`, `nameCol`, `epicLinkCol`. Its value is either a string (the matched header) or `null`. This is the *only* key in `detectedCols` that can be `null`.

### Out of scope
- The simulation engine. [Feature 0003](./0003-monte-carlo-simulation-engine.md). The `kr` value is never sampled, grouped on, or used as a capacity-allocation key. See [ADR-0022](../adr/0022-optional-key-result-column.md) for why.
- Any chart. The KR is *not* surfaced as a chart legend, a hover-tooltip line, a stacking dimension, or a color category. It lives only in the **Initiative matrix**.
- The **Data preview** (`#data-preview`). [Feature 0009](./0009-sidebar-preview-and-reference-panels.md). The preview shows fitted-model inputs, not initiative labels.
- The org-level histogram and stats table. [Feature 0006](./0006-org-histogram-chart.md), [feature 0007](./0007-org-level-summary-statistics-table.md). These surfaces have no per-initiative row to attach a KR to.
- The Team Level tab. [Feature 0011](./0011-team-level-tab.md). The team-level chart and stats table are aggregate, not row-level.
- The Initiatives tab. [Feature 0019](../../backtracked-features.md#0019). That tab shows the entire parsed CSV including the KR cell as a generic editable column; this feature does not promote the KR to a first-class field there.
- The summary table at the top of the Team Projections tab (`#proj-summary-wrap`). [Feature 0012](./0012-team-projections-tab.md). The summary is a counts-per-(team, quarter) matrix; it has no row for the KR string to attach to.
- The **Constant Work CSV** parse path. [Feature 0015](../../backtracked-features.md#0015). The constant-work KR read happens inline inside `getConstantWorkEpics` against a known-schema CSV; the detector family does not apply.
- A header-variants list shared between the Initiatives CSV detector and the Constant Work CSV inline lookup. The two lookup lists are deliberately different — see [ADR-0022](../adr/0022-optional-key-result-column.md).
- A per-KR chart, a per-KR capacity allocation, a per-KR Poisson λ, or any other future "use the KR in the simulation" surface. Listed under "Known future ideas" in `backtracked-features.md`; would re-open [ADR-0022](../adr/0022-optional-key-result-column.md) jointly with [ADR-0008](../adr/0008-poisson-epic-count.md).
- A UI control to declare whether the CSV has a KR column. The detector owns the decision; the user never sees the question.
- A validator or schema check on the KR value (e.g. "must match `KR-\d+`"). The cell is free-text by design.

## Relevant existing files
Claude may inspect:
- `index.html`, specifically:
  - `detectKrCol` at `index.html:1436-1450`.
  - The `loadInitiativesCSV` integration at `index.html:1510-1513`.
  - `detectedCols` declaration at `index.html:1501`.
  - The per-initiative `kr` assembly inside `buildTeamProjections` at `index.html:1918` (destructure) and `index.html:1964` (read).
  - The constant-work parallel lookup at `index.html:1680` inside `getConstantWorkEpics` (`index.html:1668-1686`).
  - The `hasKr` gate, KR `<td>`, and `colspan` arithmetic in `renderTeamProjections` at `index.html:2615`, `2623-2624`, `2684`, `2692`, `2698`.
- `CONTEXT.md` glossary — especially the **Key Result**, **Initiative**, **Initiative matrix**, **Projection section**, **Column detector**, **Detection fallback**, **Column-detection debug**, **Initiatives CSV**, and **Constant Work CSV** entries.
- [ADR-0022](../adr/0022-optional-key-result-column.md) — the architectural decision this feature implements.
- ADRs 0005, 0020, 0021 for the surrounding constraints.
- `docs/plans/0002-content-based-column-detection.md` and `docs/plans/0013-sensible-csv-format-support.md` for the sibling detectors' acceptance scenarios and patterns.
- `docs/plans/0012-team-projections-tab.md` — owner of the **Initiative matrix** this feature adds a column to.

Claude should not inspect unless needed:
- The Monte Carlo samplers, the bootstrap resampler, the lognormal/Poisson math — `kr` is display-only and never reaches the engine.
- The marker system, the **Capacity** plumbing, the **Quarter selector** — orthogonal.
- The Initiatives tab's editable-cell wiring — present in feature 0019 but does not interact with this feature's matrix column.

## Existing patterns to follow
- **Layering inside `index.html`**: `detectKrCol` lives in Module 1 (CSV parsing) alongside the other `detectXxxCol` functions. The `loadInitiativesCSV` integration is one line in the orchestration. The `buildTeamProjections` read is one field on the `initiatives.push({...})` object literal. The `renderTeamProjections` integration is the `hasKr` gate plus three conditional emissions in the template literal. There is *no* new module, *no* helper file, *no* refactor of the detector family.
- **Detector signature uniformity**: `detectKrCol(rows)` takes exactly the same argument shape (`rows: RowObject[]`) as the other Initiative-side detectors and returns a *single header name string* or `null`. It does not take the prior detector outputs as arguments (it has no positional fallback to compute).
- **Pure detector**: no `console.log`, no writes to `detectedCols`, no side effects. The single `[Initiatives]` log line lives one layer up in `loadInitiativesCSV` (`index.html:1513`).
- **`null` is the absent-column sentinel**: `krCol` is the *only* key in `detectedCols` that can be `null`. Every consumer guards with `krCol ? r[krCol] : ''` or with the `hasKr` gate. Do not migrate `krCol` to a sentinel string ([ADR-0022](../adr/0022-optional-key-result-column.md)).
- **State surfacing**: `detectedCols` is spread-merged on every load (`detectedCols = { ...(detectedCols || {}), ..., krCol }`); the previous load's `krCol` is overwritten cleanly on each re-upload.
- **Header variants list is the canonical KR vocabulary**: the five strings (`key_result`, `kr`, `key result`, `keyresult`, `key_results`) are the project-owned KR header names. Adding a sixth variant is a one-line append; reordering is allowed (the order encodes preference on ambiguous CSVs with multiple matching headers, where the first variant wins). The list lives inline in the detector — no module-scoped constant, no shared helper with the constant-work lookup.
- **Two-pass detection**: exact match first, case-insensitive fallback second. The two passes share the same variants list. Do not collapse them into a single case-folded pass — see [ADR-0022](../adr/0022-optional-key-result-column.md).
- **Constant-work parallel path is intentional**: `getConstantWorkEpics` reads `r.key_result || r.KR || r.kr` against a known-schema CSV. Do not refactor this into a `detectKrCol(parsedConstantWork)` call — the constant-work CSV is a hand-authored template, not a detected-schema input.
- **Conditional column gate**: the matrix's KR column is added per-section based on `hasKr = allInits.some(i => i.kr)`. The decision is *per-section*, not per-CSV. A team with no KR-tagged initiatives renders the matrix without the column even when `detectedCols.krCol !== null`.
- **`colspan` arithmetic mirrors the column count**: the `<tfoot>` `colspan` is `hasKr ? 3 : 2` (Jira Key + optional KR + Initiative Name). Any future column added between Jira Key and the quarter columns must update both the `<th>` block and the two `colspan` expressions.
- **No framework**: vanilla DOM, template literals, single `innerHTML` write per section.
- **Verification command**: there is no automated test harness in this project. Verification is manual: open `index.html`, upload CSVs with and without a KR column, press Run, click `Team Projections`, inspect the matrix.

> **Ubiquitous-language rule — applies to all sections from here down:**
> Every entity, field, and behavior name used in Data models, acceptance
> scenarios (Given/When/Then), Behavioral rules, and Invariants must match
> `CONTEXT.md` glossary terms verbatim. Do not introduce synonyms,
> abbreviations, or implementation-layer names that differ from the glossary.

## Data models

No persistence layer — this is a client-side-only app ([ADR-0002](../adr/0002-client-side-only.md)). In-memory state surfaced by this feature:

```js
// Module-scoped — declared once near the top of Module 1, unchanged in shape
// from feature 0013 except for the krCol key.
let detectedCols = null;
// { initKeyCol, moscowCol, teamCol, nameCol, krCol, epicLinkCol } | null
//
// krCol is the only field that can be null:
//   krCol: string | null  // the matched header (raw case) or null when absent

// Per-initiative shape inside buildTeamProjections' byQuarter[q].initiatives:
type ProjectionInitiative = {
  key:        string;
  name:       string;
  moscow:     'must' | 'should' | 'could' | 'wont' | 'unknown';
  kr:         string;  // '' when krCol is null or when the row's KR cell is empty
  // constant-work-only fields:
  isConstant?: boolean;
  tshirt?:    string;
  effort?:    number;
};
```

The `kr` field is always a string (possibly empty) — `null` is never propagated into the per-initiative shape. The empty-string normalisation happens at the read site (`buildTeamProjections`, `index.html:1964`; `getConstantWorkEpics`, `index.html:1680`), so downstream consumers (`renderTeamProjections`'s `hasKr` gate, the matrix row template) read a uniform string.

---

## Phase 1: `detectKrCol` — header-variants detection with `null`-on-absent

### Acceptance behavior

Scenario AT-1: **Sensible format** — KR detected by exact match on `key_result`
Given the user uploads an Initiatives CSV with headers `[jira_key, building_block, key_result, moscow, teams, quarter]`
When `loadInitiativesCSV` parses the file
Then `detectedCols.krCol === 'key_result'` (exact-match pass, first variant)

Scenario AT-2: KR detected by exact match on `kr`
Given the user uploads an Initiatives CSV with headers `[jira_key, building_block, kr, moscow, teams, quarter]`
When `loadInitiativesCSV` parses the file
Then `detectedCols.krCol === 'kr'`

Scenario AT-3: KR detected by exact match on `key result` (space, not underscore)
Given the user uploads an Initiatives CSV with headers `[jira_key, building_block, "key result", moscow, teams, quarter]`
When `loadInitiativesCSV` parses the file
Then `detectedCols.krCol === 'key result'`

Scenario AT-4: KR detected by exact match on `keyresult` (no separator)
Given the user uploads an Initiatives CSV with headers `[jira_key, building_block, keyresult, moscow, teams, quarter]`
When `loadInitiativesCSV` parses the file
Then `detectedCols.krCol === 'keyresult'`

Scenario AT-5: KR detected by exact match on `key_results` (plural)
Given the user uploads an Initiatives CSV with headers `[jira_key, building_block, key_results, moscow, teams, quarter]`
When `loadInitiativesCSV` parses the file
Then `detectedCols.krCol === 'key_results'`

Scenario AT-6: Case-insensitive fallback — `Key_Result` matches and the raw-case header is returned
Given the user uploads an Initiatives CSV with headers `[jira_key, building_block, Key_Result, moscow, teams, quarter]`
When `loadInitiativesCSV` parses the file
Then `detectedCols.krCol === 'Key_Result'` (raw-case header preserved, not `'key_result'`)
(The case-insensitive fallback fires because the exact-match pass missed `Key_Result`; the returned value is the original header so that downstream `r[krCol]` reads land on the actual column.)

Scenario AT-7: Case-insensitive fallback — `KR` matches
Given the user uploads an Initiatives CSV with headers `[jira_key, building_block, KR, moscow, teams, quarter]`
When `loadInitiativesCSV` parses the file
Then `detectedCols.krCol === 'KR'`

Scenario AT-8: No KR column — `krCol` is `null`
Given the user uploads an Initiatives CSV with headers `[jira_key, building_block, moscow, teams, quarter]` (no KR variant)
When `loadInitiativesCSV` parses the file
Then `detectedCols.krCol === null`
And no exception is thrown
And the `[Initiatives]` console log shows `kr="null"`

Scenario AT-9: Empty CSV — `detectKrCol([])` returns `null`
Given `parsedInitiatives.length === 0` (header-only or fully empty CSV)
When `detectKrCol([])` runs
Then it returns `null`
And no `Object.keys` call is made against an undefined row

Scenario AT-10: Exact-match precedence — when both `key_result` and `kr` are present, `key_result` wins
Given the user uploads a CSV with headers `[jira_key, kr, key_result, moscow, teams, quarter]` (both variants present)
When `loadInitiativesCSV` parses the file
Then `detectedCols.krCol === 'key_result'` (first variant in the list takes precedence)
(The variants array's order is the tie-breaker; `key_result` is listed before `kr`.)

Scenario AT-11: Unrelated header that *contains* a KR substring is not matched
Given the user uploads a CSV with headers `[jira_key, key_result_owner, moscow, teams, quarter]` (no exact `key_result` header)
When `loadInitiativesCSV` parses the file
Then `detectedCols.krCol === null`
(The detector uses `headers.includes(c)`, not `headers.some(h => h.includes(c))` — substring matches are not allowed.)

Scenario AT-12: Whitespace-padded header is not matched
Given the user uploads a CSV with headers `[jira_key, " key_result ", moscow, teams, quarter]` (with leading/trailing spaces)
When `loadInitiativesCSV` parses the file
Then `detectedCols.krCol === null`
(PapaParse preserves whitespace in headers; the detector does not trim. This is intentional — the user can rename the header to remove the spaces.)

Scenario AT-13: An exact-match hit on an *uppercase* variant short-circuits the case-insensitive pass
Given the user uploads a CSV with headers `[jira_key, KR, moscow, teams, quarter]`
When `loadInitiativesCSV` parses the file
Then `detectedCols.krCol === 'KR'`
(The exact-match pass walks `['key_result', 'kr', ...]`; `kr` lowercase is not in the headers, but the case-insensitive fallback finds `KR` and returns the raw-case header. Either way, `'KR'` is returned, not `'kr'`.)

### Public entry point

In-code: `detectKrCol(rows: RowObject[]): string | null` (`index.html:1436`). Called once per Initiatives load from `loadInitiativesCSV` (`index.html:1511`).

UI: the **Column-detection debug** panel's `<pre id="debug-pre">` shows the result of the detection under `Detected columns:`.

### Expected observable outcomes
- `detectedCols.krCol` is either a non-empty string equal to a header that exists in the parsed rows, or `null`.
- The `[Initiatives]` console log line includes `kr="${krCol}"` — either the matched header name or the literal `"null"`.
- The case-insensitive fallback returns the *raw-case* header (e.g. `'KR'`, `'Key_Result'`), not the lowercased variant — so downstream `r[krCol]` reads land on the actual column.
- The detector never throws on empty rows.
- The detector is *pure*: same `rows` ⇒ same return value, no side effects.

### Test harness

Acceptance tests:
- Location: **N/A — manual.** This project has no automated test suite.
- Manual steps:
  1. Construct a CSV with `key_result` as a column. Upload. Open the **Column-detection debug** panel. Confirm `krCol: "key_result"`.
  2. Repeat with `kr`, `key result`, `keyresult`, `key_results` — confirm each variant lands as `krCol` (AT-1 through AT-5).
  3. Construct a CSV with `Key_Result` (mixed case). Upload. Confirm `krCol: "Key_Result"` (raw case preserved) (AT-6).
  4. Construct a CSV with `KR` (uppercase). Upload. Confirm `krCol: "KR"` (AT-7, AT-13).
  5. Construct a CSV with no KR-shaped header. Upload. Confirm `krCol: null` and the log line shows `kr="null"` (AT-8).
  6. From the DevTools console, call `detectKrCol([])` and confirm it returns `null` (AT-9).
  7. Construct a CSV with both `key_result` and `kr` headers present. Confirm `krCol: "key_result"` (AT-10).
  8. Construct a CSV with `key_result_owner` (substring match). Confirm `krCol: null` (AT-11).
  9. Construct a CSV with `" key_result "` (whitespace-padded). Confirm `krCol: null` (AT-12).

Inner tests: N/A.

Verification: manual.

Fake-injection wiring: N/A. The detector is pure; the only input is the `rows` argument.

### Proposed implementation seams

Stable seams a future test suite may target:
- `detectKrCol(rows: RowObject[]): string | null` — pure, returns a header name or `null`.
- The two-pass structure: exact match first (returns the variant string by construction, since the variant equals the header on hit), case-insensitive fallback second (returns the *raw-case* header).
- The variants list as the canonical KR vocabulary: `['key_result', 'kr', 'key result', 'keyresult', 'key_results']`.
- `null` as the absent-column sentinel.

Do NOT lock in:
- The exact contents of the variants list — additive future revisions are allowed without re-opening [ADR-0022](../adr/0022-optional-key-result-column.md).
- The order of the variants beyond the first-wins tie-breaker rule.
- The lack of trimming on header names — this could be added in a future revision if user-reported whitespace bugs accumulate.

### Behavioral rule

`detectKrCol` walks a fixed list of header variants in two passes: an *exact* `includes` check against the parsed headers, then a case-insensitive `includes` check against the lowercased headers (with the *raw-case* header name returned on hit). The first hit in either pass wins. When no variant matches in either pass, the detector returns `null` — the absent-column sentinel. Empty inputs return `null`. The variants list — `['key_result', 'kr', 'key result', 'keyresult', 'key_results']` — is the project's canonical KR vocabulary; it does not change with the CSV format.

### Invariants
- `detectKrCol(rows)` is a *total function*: it returns either a string or `null` for every input, including the empty-rows case.
- The returned string, when non-`null`, is *always* one of the keys of `rows[0]` — the detector never fabricates a header name.
- `detectKrCol(rows)` is deterministic — same `rows` ⇒ same return.
- The variants list is the same across formats — `detectKrCol` is *not* asymmetric between **Sensible format** and **Quirky format** loads (contrast with `detectInitKeyCol` / `detectMoscowCol` / `detectNameCol` / `detectTeamCol` in [feature 0013](./0013-sensible-csv-format-support.md)).
- The case-insensitive fallback returns the *raw-case* header from `Object.keys(rows[0])` at the matching index, not the lowercased variant.
- The detector is pure: no `console.log`, no writes to `detectedCols`, no mutation of `rows`.

### Counterexamples (must NOT pass)
- A detector that returns `'key_result'` (the **Sensible format** default) when no variant is found — would silently make `r[krCol]` read from a non-existent column on every initiative; `kr` would be `undefined` (which `(undefined || '').trim()` masks, but the `hasKr` gate would never trigger).
- A detector that returns the *lowercased* variant on the case-insensitive fallback hit — `r['key_result']` would miss when the actual column is `Key_Result`.
- A detector that throws on empty rows — empty CSVs are a user-reachable state and must produce `null`.
- A detector that uses `headers.some(h => h.includes(c))` instead of `headers.includes(c)` — substring matches would falsely claim `key_result_owner` or `kr_id`.
- A detector that trims headers before comparison — would silently match `" key_result "` and create surprising sensitivity to the user's CSV editor behavior.
- A detector that case-folds the headers *and* the variants in a single pass — would still produce the right `krCol` value on most inputs, but would lose the documented two-pass structure that surfaces the "did the fallback fire?" question in the **Column-detection debug** panel.
- A detector that returns `''` (empty string) instead of `null` for the absent case — would force every consumer to special-case both `''` and `null`, defeating the explicit-optionality contract.

### Forbidden shortcuts
- Do not migrate `krCol` to a string sentinel (`'key_result'`, `''`, or `'(absent)'`). The `null` return is the documented contract — see [ADR-0022](../adr/0022-optional-key-result-column.md).
- Do not introduce a content scan over the rows to look for "KR-shaped" values. Key Results have no content fingerprint — see [ADR-0022](../adr/0022-optional-key-result-column.md).
- Do not share the variants list with the constant-work CSV's KR lookup (`getConstantWorkEpics`, `index.html:1680`). The two lookup lists are intentionally different — see [ADR-0022](../adr/0022-optional-key-result-column.md).
- Do not log from inside the detector. The `[Initiatives]` log line lives in `loadInitiativesCSV`.
- Do not assume the variants list is sorted alphabetically or by length. The order encodes preference on ambiguous CSVs with multiple matching headers — first wins.

### RED gate

On an unimplemented build (detector returns a string sentinel like the other detectors, or does not exist at all):
- Manual step 5 (no KR header): `detectedCols.krCol === 'key_result'` (a sentinel string) — and the `hasKr` gate downstream evaluates to `false` only by coincidence (because `r['key_result']` returns `undefined` which the `(undefined || '').trim()` masks).
- Manual step 6 (`detectKrCol([])`): undefined or throws.
- Manual step 8 (`key_result_owner` substring): falsely returns `'key_result_owner'` if the detector uses `some(h => h.includes(c))`.

### Test immutability rule

There are no test files to freeze (manual harness). If a test suite is later introduced for this detector, those tests would live under `tests/acceptance/` and be off-limits to the implementation session.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-13 all pass in a fresh browser tab.
- [ ] `krCol` is `null` exactly when no variant is present (exact or case-insensitive).
- [ ] The raw-case header is returned on case-insensitive fallback hits.
- [ ] The variants list is `['key_result', 'kr', 'key result', 'keyresult', 'key_results']` in that order.
- [ ] No content scan, no substring match, no header trim.
- [ ] `git diff` for this phase touches only `index.html` (plus this plan, the ADR, and CONTEXT.md per [ADR-0001](../adr/0001-single-file-html-app.md)).

---

## Phase 2: Per-initiative `kr` plumbing — `buildTeamProjections` and constant-work parallel path

### Acceptance behavior

Scenario AT-1: KR is read from the detected column when `krCol !== null`
Given `detectedCols.krCol === 'key_result'`
And an initiative row has `key_result: 'KR-7'`
When `buildTeamProjections` runs and assembles that row
Then the resulting initiative object has `kr === 'KR-7'`

Scenario AT-2: KR is the empty string when `krCol === null`
Given `detectedCols.krCol === null` (no KR column detected)
And the initiative row has no KR-shaped field
When `buildTeamProjections` runs
Then every initiative's `kr === ''`
And no row reads from a non-existent column (no `r[null]` access)

Scenario AT-3: Empty KR cell normalises to `''`
Given `detectedCols.krCol === 'key_result'`
And an initiative row has `key_result: ''` (or only whitespace)
When `buildTeamProjections` runs
Then the resulting initiative object has `kr === ''`
(The `.trim()` collapses whitespace-only cells to `''`.)

Scenario AT-4: KR with surrounding whitespace is trimmed
Given an initiative row has `key_result: '  KR-7  '`
When `buildTeamProjections` runs
Then the resulting initiative object has `kr === 'KR-7'`

Scenario AT-5: Constant-work rows carry their own KR via the parallel lookup
Given the **Constant Work CSV** has a row with `key_result: 'KR-12'` (and `team`, `quarter`, `tshirt_size` populated)
When `getConstantWorkEpics(quarter, teamName)` is called for the matching team and quarter
Then the returned constant-work entry has `kr === 'KR-12'`
And the lookup checks `r.key_result || r.KR || r.kr` in that order
And does *not* invoke `detectKrCol`

Scenario AT-6: Constant-work KR uses the `key_result | KR | kr` precedence
Given a constant-work row with both `KR: 'KR-1'` and `kr: 'KR-2'` (no `key_result`)
When `getConstantWorkEpics` runs
Then the returned entry has `kr === 'KR-1'` (the `KR` field wins because `key_result` is empty and `KR` is checked before `kr`)
(The three-element list is `r.key_result || r.KR || r.kr`, evaluated left to right.)

Scenario AT-7: Missing constant-work KR normalises to `''`
Given a constant-work row with no `key_result`, no `KR`, and no `kr` field
When `getConstantWorkEpics` runs
Then the returned entry has `kr === ''`

Scenario AT-8: KR plumbing is read-only — no engine consumer reads `kr`
Given any in-memory `ProjectionInitiative` object
When `runSimulation`, `prepareSimulationData`, `prepareTeamSimulationData`, `samplePoisson`, `sampleLognormal`, `bootstrapChoice`, or any of the **Stats** computations runs
Then no code path reads the `.kr` field
(Grep `index.html` for `.kr` outside of `buildTeamProjections`, `getConstantWorkEpics`, and `renderTeamProjections` — there must be no hits.)

### Public entry point

In-code:
- The `kr` field on the initiative object literal inside `buildTeamProjections` (`index.html:1964`).
- The `kr` field on the constant-work object literal inside `getConstantWorkEpics` (`index.html:1680`).
- The `detectedCols` destructure at the top of `buildTeamProjections` (`index.html:1918`) — exposes `krCol` to the inner read.

UI: indirectly — the **Initiative matrix** in each **Projection section** reads these `kr` values (Phase 3).

### Expected observable outcomes
- Every `ProjectionInitiative.kr` is a string. `null` is never propagated from `krCol` to `kr`.
- Empty cells, whitespace-only cells, and absent-column cases all normalise to `''`.
- Constant-work entries carry their own `kr` via the inline `r.key_result || r.KR || r.kr` lookup, independently of `detectKrCol`.
- The `kr` field is read by exactly two functions (`buildTeamProjections`, `getConstantWorkEpics`) and consumed by exactly one renderer (`renderTeamProjections`). No simulation engine code reads it.

### Test harness

Acceptance tests:
- Location: **N/A — manual.**
- Manual steps:
  1. After a Run with a KR-bearing CSV, in DevTools: `buildTeamProjections(extractQuarters(editedInitiatives), 4.32, ['S','M','L'], 3000)` and walk the returned structure. Confirm `kr` strings on `byQuarter[q].initiatives[i]` (AT-1).
  2. Upload a CSV with no KR column. Confirm every initiative's `kr === ''` (AT-2).
  3. Construct a CSV with whitespace-padded KR cells. Confirm `kr` is trimmed (AT-4).
  4. Upload a **Constant Work CSV** with a `key_result` column. After Run, inspect `byQuarter[q].initiatives` and confirm the constant-work entry's `kr` is populated (AT-5).
  5. Construct constant-work rows with each of `key_result`, `KR`, `kr` and combinations; confirm the precedence (AT-6).
  6. Grep `index.html` for `\.kr\b` and confirm there is no read outside of `buildTeamProjections`, `getConstantWorkEpics`, and `renderTeamProjections` (AT-8).

Inner tests: N/A.

Verification: manual.

Fake-injection wiring: N/A. The plumbing reads from in-memory state populated by the previous CSV loads.

### Proposed implementation seams

Stable seams:
- The `kr: krCol ? (r[krCol] || '').trim() : ''` expression in `buildTeamProjections` — handles both the absent-column case (`krCol === null`) and the empty/whitespace cell case in one line.
- The `kr: (r.key_result || r.KR || r.kr || '').trim()` expression in `getConstantWorkEpics` — the parallel three-element lookup.
- The shape of `ProjectionInitiative.kr`: `string`, never `null`, never `undefined`.

Do NOT lock in:
- The exact precedence of the constant-work lookup beyond "left-most non-empty wins". A future revision could re-order without re-opening [ADR-0022](../adr/0022-optional-key-result-column.md), as long as it remains a small known list.
- The choice to read at construction time (vs. lazily on render). The read happens once per Run; lazy reads are not necessary at this scale.

### Behavioral rule

`buildTeamProjections` reads each initiative's KR via the detected column when `detectedCols.krCol !== null` (`r[krCol]`), trims the result, and stores it on the per-initiative object as `kr: string` (possibly `''`). When `krCol === null`, every initiative's `kr === ''` and no row reads from a non-existent header. `getConstantWorkEpics` reads its row's KR independently via a small inline precedence list (`r.key_result || r.KR || r.kr`) and stores the result as `kr: string` on the constant-work entry. No simulation engine consumer ever reads `.kr`.

### Invariants
- `ProjectionInitiative.kr` is always a string. Never `null`, never `undefined`.
- The empty string is the universal "no KR" representation downstream — both "no column detected" and "column detected but cell empty" map to `''`.
- The `r[krCol]` read is *gated* on `krCol !== null` — there is no `r[null]` access path.
- The constant-work KR lookup does *not* invoke `detectKrCol`. The two paths are independent.
- No code path outside of `buildTeamProjections`, `getConstantWorkEpics`, and `renderTeamProjections` reads `.kr`.

### Counterexamples (must NOT pass)
- A read that does `r[detectedCols.krCol]` without guarding on `krCol !== null` — produces `r[null]` which evaluates to `undefined`, masked by `(undefined || '').trim()` but defeats the explicit-optionality contract.
- A read that omits the `.trim()` — would surface whitespace-only cells as truthy in the `hasKr` gate, falsely triggering the KR column to render.
- A constant-work lookup that invokes `detectKrCol(parsedConstantWork)` — would couple the two CSV schemas and re-open [ADR-0022](../adr/0022-optional-key-result-column.md).
- A simulation engine read of `.kr` (e.g. a per-KR Poisson λ, a per-KR bootstrap pool) — out of scope by [ADR-0022](../adr/0022-optional-key-result-column.md).
- A `kr` value set to `null` or `undefined` on the per-initiative object — would force every consumer to truthiness-check rather than empty-string-check.

### Forbidden shortcuts
- Do not lift the `kr` read into a `lookupKr(row, detectedCols)` helper. The two read sites are deliberately different (Initiatives CSV uses detected column; Constant Work CSV uses hardcoded precedence) — see [ADR-0022](../adr/0022-optional-key-result-column.md).
- Do not pre-trim the parsed CSV cells in `parseCSV` to avoid the `.trim()` here. Other consumers may rely on the raw cell values.
- Do not pre-normalise `null` `krCol` to `''` in `loadInitiativesCSV`. The `null` is the documented sentinel; consumers gate on it.

### RED gate

On an unimplemented build (the `kr` field is missing or `krCol` is not threaded through):
- Manual step 1: `byQuarter[q].initiatives[i].kr` is `undefined`.
- Manual step 4: constant-work entries lack a `kr` field entirely.
- Manual step 6: grep finds reads of `.kr` from the simulation engine.

### Test immutability rule

N/A.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-8 all pass.
- [ ] `ProjectionInitiative.kr` is always a string.
- [ ] The `null`-guard on `krCol` prevents any `r[null]` access.
- [ ] The constant-work parallel lookup remains independent of `detectKrCol`.
- [ ] No simulation engine code reads `.kr`.

---

## Phase 3: Conditional KR column in the Initiative matrix

### Acceptance behavior

Scenario AT-1: KR column appears when at least one initiative in the section has a non-empty `kr`
Given the **Initiative matrix** for team `Platform` has 3 initiatives, one with `kr === 'KR-7'` and two with `kr === ''`
When `renderTeamProjections` runs
Then the matrix `<thead>` row contains `<th style="width:60px">KR</th>` between `Jira Key` and `Initiative Name`
And the row for the KR-bearing initiative shows `KR-7` in the KR cell (indigo, bold)
And the rows for the KR-less initiatives show `—` in the KR cell

Scenario AT-2: KR column is absent when every initiative in the section has an empty `kr`
Given the matrix for team `Risk` has 4 initiatives, all with `kr === ''`
When `renderTeamProjections` runs
Then the matrix has no `<th>KR</th>` header
And every row has no KR `<td>`
And the table is narrower by exactly one column

Scenario AT-3: KR column is per-section, not per-CSV
Given the loaded CSV has `detectedCols.krCol === 'key_result'`
And team `Platform` has at least one initiative with a non-empty `kr`
And team `Risk` has no initiatives with a non-empty `kr`
When `renderTeamProjections` runs
Then the `Platform` section's matrix shows the KR column
And the `Risk` section's matrix does not

Scenario AT-4: Constant-work rows count toward the section's `hasKr` gate
Given team `Platform` has 0 Initiatives with a `kr` value
And 1 constant-work entry in the **Constant Work CSV** with `key_result: 'KR-99'` for team `Platform`
When `renderTeamProjections` runs
Then the `Platform` section's matrix shows the KR column
And the constant-work row shows `KR-99` in its KR cell
(The `allInits` array — over which `hasKr` is computed — is the flat union of every quarter's `byQuarter[q].initiatives`, *including* the appended constant-work rows. The gate fires on either an Initiative or a constant-work entry carrying a KR.)

Scenario AT-5: KR cell content is the `kr` string when non-empty, otherwise an em-dash
Given an initiative has `kr === 'KR-7'`
When the row renders inside a section where `hasKr === true`
Then the KR cell reads `KR-7` (indigo, bold, `font-size:11px`)
Given an initiative has `kr === ''` in a section where `hasKr === true`
Then the KR cell reads `—` (em-dash, same indigo/bold styling)
(The em-dash is a placeholder, not a missing-cell; the column is present for the section, just empty for this row.)

Scenario AT-6: `<tfoot>` `colspan` reflects the KR column count
Given a section's `hasKr === true`
When `renderTeamProjections` runs
Then the `Initiatives count` footer row's first `<td>` has `colspan="3"` (Jira Key + KR + Initiative Name)
And the `Effort P50 (P25–P75)` footer row's first `<td>` has `colspan="3"`
Given a section's `hasKr === false`
Then both footer rows' first `<td>` has `colspan="2"`
(Failing to update either `colspan` misaligns the count chips and effort band from their corresponding `<th class="qcol">` quarter columns.)

Scenario AT-7: KR header is between `Jira Key` and `Initiative Name`
Given a section's `hasKr === true`
When the matrix `<thead>` renders
Then the column order is `Jira Key | KR | Initiative Name | Q? YYYY | ...` (KR is the second column, not the last and not after the quarter columns)
(The fixed position is important: the user reads the table left-to-right, and the KR is part of the "identification" group with Jira Key and Initiative Name — not part of the "per-quarter status" group.)

Scenario AT-8: KR column survives a re-render with new data
Given a previous Run rendered a section without a KR column (no KR-bearing initiatives)
And the user edits an initiative on the Initiatives tab to set a KR value
And the user re-presses **Run Simulation**
When `renderTeamProjections` runs
Then the new render shows the KR column for the section
(Because `editedInitiatives` is the source `buildTeamProjections` reads; the next Run re-evaluates `hasKr` from scratch.)

Scenario AT-9: KR column does *not* appear when `detectedCols.krCol === null` (regardless of any inline `kr` strings)
Given the loaded **Initiatives CSV** has no KR column header
And `detectedCols.krCol === null`
When `renderTeamProjections` runs
Then no section has a KR column
And every initiative's `kr === ''` (because `buildTeamProjections`'s guard returned `''` for every row)
(The `hasKr` gate evaluates to `false` because no row has a non-empty `kr`.)

Scenario AT-10: KR column does not affect any chart
Given a section's `hasKr === true`
When the count chart and the effort projection chart render
Then neither chart has a KR-related dataset, axis, legend entry, or hover tooltip
(The KR is matrix-only.)

Scenario AT-11: KR cell styling is the same in Initiative rows and Constant-work rows
Given a section has both KR-bearing Initiatives and KR-bearing constant-work rows
When the matrix renders
Then both row types use the same KR `<td>` styling (indigo, bold, `font-size:11px`, `white-space:nowrap`)
And the green tint (`#f0fdf4`) on the constant-work row's background does *not* override the KR cell's indigo text colour

### Public entry point

In-code: the matrix-building block inside `renderTeamProjections` (`index.html:2615-2707`), specifically:
- `hasKr` computation (`index.html:2615`).
- KR `<td>` emission per row (`index.html:2623-2624`).
- KR `<th>` emission (`index.html:2684`).
- `colspan` on both `<tfoot>` rows (`index.html:2692`, `2698`).

UI: the **Initiative matrix** inside each `.proj-team-section` in the `Team Projections` tab.

### Expected observable outcomes
- A section with at least one Initiative or constant-work row carrying a non-empty `kr` renders a KR column.
- A section without any non-empty `kr` renders no KR column.
- The KR column is between `Jira Key` and `Initiative Name`, never anywhere else.
- The `colspan` on both `<tfoot>` first cells is `3` when `hasKr === true`, `2` otherwise.
- The KR cell content is the `kr` string when non-empty, otherwise the em-dash glyph.
- The KR column never appears in any chart, in the summary table, or outside the per-team **Initiative matrix**.

### Test harness

Acceptance tests:
- Location: **N/A — manual.**
- Manual steps:
  1. Load a CSV with KR values on some initiatives. Press Run. Click `Team Projections`. Confirm the KR column appears in sections whose initiatives carry a KR (AT-1, AT-3).
  2. Confirm a team with no KR-bearing initiatives renders without the KR column even when the CSV has the column (AT-3, AT-2).
  3. Load a Constant Work CSV that includes `key_result` values; confirm those rows trigger the KR column for the matching team's section (AT-4).
  4. Inspect the KR cell for a KR-less row in a section where the column is present; confirm the em-dash (AT-5).
  5. Inspect the `<tfoot>` rows of a section with the KR column; confirm `colspan="3"`. Inspect a section without; confirm `colspan="2"` (AT-6).
  6. Inspect the matrix header order; confirm `Jira Key | KR | Initiative Name | Q...` (AT-7).
  7. Edit an Initiative on the Initiatives tab to add a KR. Re-press **Run**. Confirm the KR column appears in the next render (AT-8).
  8. Load a CSV with *no* KR column. Confirm no section has a KR column (AT-9).
  9. Inspect the count chart and the effort projection chart; confirm no KR-related elements (AT-10).
  10. Inspect the styling on a constant-work KR cell vs. an Initiative KR cell; confirm uniform indigo/bold text (AT-11).

Inner tests: N/A.

Verification: manual.

Fake-injection wiring: N/A.

### Proposed implementation seams

Stable seams a future test suite may target:
- `hasKr = allInits.some(i => i.kr)` as the per-section gate.
- The KR column position (between `Jira Key` and `Initiative Name`).
- The `<tfoot>` `colspan` formula (`hasKr ? 3 : 2`).
- The em-dash placeholder for empty `kr` cells inside a section with the column present.

Do NOT lock in:
- The exact CSS class name `kr-col` — purely presentational.
- The exact indigo colour (`#6366f1`) and `font-size:11px` — UX call.
- The `width:60px` on the `<th>` — visual tuning.
- The em-dash glyph itself — could be replaced with a blank cell in a future revision.

### Behavioral rule

`renderTeamProjections` evaluates `hasKr = allInits.some(i => i.kr)` per section, where `allInits` is the flat union of every quarter's initiatives plus the appended constant-work rows. When `hasKr === true`, the section's **Initiative matrix** includes a `KR` column between `Jira Key` and `Initiative Name`, each row's KR cell carrying either the trimmed `kr` string or an em-dash placeholder, and the two `<tfoot>` rows' first cells use `colspan="3"`. When `hasKr === false`, the column is omitted entirely and `colspan="2"` is used. The decision is per-section: a CSV with mixed-KR coverage produces some sections with the column and some without. The KR column never appears outside the **Initiative matrix**.

### Invariants
- `hasKr === false` ⇒ no KR `<th>`, no KR `<td>` on any row, `colspan="2"` on both `<tfoot>` rows.
- `hasKr === true` ⇒ exactly one `<th>` for KR, exactly one KR `<td>` per body row (Initiative or constant-work), `colspan="3"` on both `<tfoot>` rows.
- The KR column is at a fixed position: between `Jira Key` and `Initiative Name`. It is never after the quarter columns.
- The KR column never appears in any chart, in the summary table at the top of the tab, or anywhere outside the per-section **Initiative matrix**.
- A row with `i.kr === ''` in a section where `hasKr === true` renders a KR cell containing the em-dash glyph (`—`), not an empty `<td>`.
- The KR cell styling is uniform across Initiative rows and constant-work rows (the constant-work green row tint does not override the indigo text colour).
- Both `<tfoot>` rows' `colspan` values agree with each other and with the `hasKr` decision. A mismatch silently misaligns the count chips and effort band from their quarter columns.

### Counterexamples (must NOT pass)
- A renderer that adds the KR `<th>` to *every* section regardless of `hasKr` — wastes horizontal space and contradicts the documented "only-when-present" rule.
- A renderer that adds the KR `<th>` only when `detectedCols.krCol !== null` (skipping the value-present check) — would render an all-em-dash column for teams whose initiatives happen to have empty KR cells.
- A renderer that adds the KR `<th>` but emits no KR `<td>` on rows where `i.kr === ''` (creating column-count drift) — the row's `<td>` count would mismatch the `<th>` count and the table would visually misalign.
- A renderer that updates the KR `<th>` but forgets to update the `<tfoot>` `colspan` — the count chips and effort band footer cells would shift left by one column, misaligning from their quarter `<th>` columns.
- A renderer that places the KR column after the quarter columns — the user reading the matrix left-to-right loses the "identification group" (Jira Key + KR + Initiative Name) before they hit the per-quarter status group.
- A renderer that mutates `allInits` in place to filter out empty-`kr` rows when `hasKr === true` — would silently hide initiatives whose KR is blank.
- A renderer that emits an empty `<td></td>` for KR-less rows in a section where `hasKr === true` instead of the em-dash glyph — visually conflates "no KR for this initiative" with "missing cell entirely".

### Forbidden shortcuts
- Do not add a KR column to any other surface (the summary table at `#proj-summary-wrap`, the Team Level tab's stats table, the org-level histogram, the **Data preview**). The matrix is the single surface where the KR lives — see [ADR-0022](../adr/0022-optional-key-result-column.md).
- Do not add the KR string to chart tooltips. The KR is not a chart dimension.
- Do not introduce a per-section toggle to "show all columns" that would render the KR column even when `hasKr === false`. The conditional rendering is intentional.
- Do not animate the column's appearance/disappearance between Runs. Re-renders are instantaneous by the rest of the tab's convention.
- Do not lift the `hasKr` computation into `buildTeamProjections` (e.g. as a per-team boolean on the `ProjectionTeamData` shape). The decision belongs at the render layer because it is presentation, not data — and folding it into the builder would mix `displayQuarters`-style render concerns into the pure builder ([feature 0012](./0012-team-projections-tab.md)).

### RED gate

On an unimplemented build (the matrix has no KR column logic):
- Manual step 1: the matrix has no KR column despite KR-bearing initiatives.
- Manual step 5: the `<tfoot>` `colspan` is hard-coded to `2`, so adding a KR column manually misaligns the footer.
- Manual step 6: the column order is wrong (KR appears after the quarter columns, or in another section).

### Test immutability rule

N/A.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-11 all pass in a fresh browser tab.
- [ ] The KR column appears per-section, gated on `hasKr = allInits.some(i => i.kr)`.
- [ ] Both `<tfoot>` rows' `colspan` track `hasKr`.
- [ ] The KR column sits between `Jira Key` and `Initiative Name`, never elsewhere.
- [ ] The KR column is absent from every chart, the summary table, and every other UI surface.
- [ ] Constant-work rows participate in the gate and render their KR with the same styling as Initiative rows.
- [ ] `git diff` for this phase touches only `index.html` (plus this plan, the ADR, and CONTEXT.md per [ADR-0001](../adr/0001-single-file-html-app.md)).
