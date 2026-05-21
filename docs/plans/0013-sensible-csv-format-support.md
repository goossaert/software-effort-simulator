# Feature: Sensible CSV format support — direct header-name matches alongside content-scan detection

Created at: 2026-05-21T00:00:00Z

## Context

This feature extends the **Column detectors** introduced by [feature 0002](./0002-content-based-column-detection.md) so that the **Sensible format** (`jira_key`, `building_block`, `moscow`, `teams`) lands on a direct, header-name-keyed path — not only via the **Content scan**'s coincidental matches. The detectors already handle the legacy **Quirky format** (`teams` carries Jira keys, `emoji` carries MoSCoW priority) through value scans; this feature adds a *per-detector* direct header-name branch so the **Sensible format** path is fast, unambiguous, and robust to column reordering. The legacy positional inference inside `detectNameCol` and `detectTeamCol` (read the header *before* the Initiative key column or *before* the MoSCoW column respectively) survives as a fallback for **Quirky format** CSVs that do not have a `building_block` or `teams` header.

This is a small, surgical feature — four detectors gain one or two extra branches each — but the architectural choice it encodes (per-column dual-format support emergent from per-detector logic, not a CSV-level format enum) is load-bearing. See [ADR-0021](../adr/0021-sensible-csv-format-dual-support.md) for the *why*; this plan covers the *what* and the *how to verify*.

Relevant cross-cutting decisions:
- [ADR-0001 — Single-file HTML app, no build step](../adr/0001-single-file-html-app.md). All detectors live as module-scoped functions inside `index.html`; this feature mutates them in place.
- [ADR-0003 — CSV as the input format](../adr/0003-csv-input-format.md). Accepting any tool's CSV means we cannot dictate header names; this feature adds the **Sensible format** as the recommended layout without removing **Quirky format** support.
- [ADR-0005 — Content-based column detection over header-name matching](../adr/0005-content-based-column-detection.md). The **Content scan** is still the canonical detection strategy for the Initiative key and MoSCoW columns; this feature adds a `jira_key`/`moscow` **Detection fallback** path and inverts the priority for name and team.
- [ADR-0021 — Direct header-name matching for the Sensible format alongside content-scan detection](../adr/0021-sensible-csv-format-dual-support.md). The architectural decision for *why* the direct header-name branch lives *before* the content scan for `detectNameCol`/`detectTeamCol` and *after* it for `detectInitKeyCol`/`detectMoscowCol`, and *why* both formats are supported simultaneously rather than migrated.

Glossary terms used below: **Sensible format**, **Quirky format**, **Column detector**, **Content scan**, **Detection threshold**, **Detection fallback**, **Initiative key**, **MoSCoW**, **Initiative**, **Team**, **Column-detection debug** (see [CONTEXT.md](../../CONTEXT.md)).

## User-visible behavior

A user who exports their Initiatives CSV from the recommended **Sensible format** template — headers `jira_key, building_block, moscow, teams, quarter` — uploads the file and immediately sees the **Data preview** populate with the correct counts, the correct **Poisson λ**, and the correct **MoSCoW** breakdown. The **Column-detection debug** panel shows:

```json
Detected columns: {
  "initKeyCol": "jira_key",
  "moscowCol": "moscow",
  "teamCol": "teams",
  "nameCol": "building_block",
  "krCol": null,
  "epicLinkCol": "(normalised→_initiative_key)"
}
```

A user who uploads a legacy **Quirky format** CSV (`name, teams, emoji, team, quarter` where `teams` carries Jira keys and `emoji` carries MoSCoW priority) sees the same simulator behavior — the debug panel just shows the **Quirky format** headers selected for the same semantic columns. Both formats round-trip through `loadInitiativesCSV` with identical downstream effects.

A user who *renames* their headers to **Sensible format** mid-session and re-uploads sees the debug panel update on the next load to show the **Sensible format** headers selected — confirming the format change. The simulator never asks the user to declare a format; the answer is always emergent from `detectedCols`.

A user who uploads a *hybrid* CSV — for example, the **Sensible format**'s `jira_key` and `moscow` headers but a `team_name` instead of `teams` — sees `detectedCols.initKeyCol === 'jira_key'`, `detectedCols.moscowCol === 'moscow'`, and `detectedCols.teamCol` falls back to the positional inference (the header before `moscow`). Each column is independently detected; there is no CSV-level format flag that would force all four columns into one or the other format.

There is no new UI control, no new sidebar widget, no new error message. The feature is observable *only* through the **Column-detection debug** panel's JSON.

## Scope

### In scope
- `detectInitKeyCol(rows)` (`index.html:1357-1369`):
  - Existing **Content scan** for the Jira-key regex `/^[A-Z][A-Z0-9_]+-\d+$/` over each column with the **Detection threshold** `> 0.5` — unchanged.
  - **Detection fallback** (when no column clears the threshold): `headers.includes('jira_key')` → return `'jira_key'`; otherwise return `'teams'` (legacy **Quirky format** default).
  - Zero-rows return: `'jira_key'` (switched from a **Quirky format** default to the **Sensible format** default).
- `detectMoscowCol(rows)` (`index.html:1376-1388`):
  - Existing **Content scan** for the MoSCoW keyword regex `/must|should|could|won.t/i` with the **Detection threshold** `> 0.5` — unchanged.
  - **Detection fallback**: `headers.includes('moscow')` → return `'moscow'`; otherwise return `'emoji'` (legacy **Quirky format** default).
  - Zero-rows return: `'moscow'` (switched to the **Sensible format** default).
- `detectNameCol(rows, initKeyColHeader)` (`index.html:1396-1408`):
  - Direct header-name match: `headers.includes('building_block')` → return `'building_block'` (this is the *first* branch, evaluated before any positional fallback).
  - Positional fallback: the header at index `headers.indexOf(initKeyColHeader) - 1` (the column immediately before the Initiative key column) when that index is `> 0`.
  - Final fallback (zero-rows or `initKeyColHeader` at position 0): return `'building_block'`.
- `detectTeamCol(rows, initKeyColHeader, moscowColHeader)` (`index.html:1416-1430`):
  - Direct header-name match: `headers.includes('teams')` → return `'teams'` (first branch).
  - Positional fallback: the header at index `headers.indexOf(moscowColHeader) - 1` (the column immediately before the MoSCoW column) *only when that header is not the same as `initKeyColHeader`* — preserves the [feature 0002](./0002-content-based-column-detection.md) guard that `teamCol !== initKeyCol`.
  - Final fallback: return `'teams'`.
- `detectKrCol(rows)` (`index.html:1436-1450`): **unchanged from feature 0002**. The Key Result column has no **Sensible format** vs **Quirky format** divergence; it is detected by a flat list of header variants regardless of format. Listed here for completeness; this feature does not modify it.
- `detectEpicLinkCol(rows)` (`index.html:1457-1476`): **unchanged from feature 0002**. The Epic→Initiative link column is detected by header heuristic then content scan; both formats share the same heuristic. Listed for completeness.
- The behavior contract: `detectedCols` after a successful `loadInitiativesCSV` (`index.html:1503-1516`) contains exactly the same six keys as feature 0002 — `initKeyCol`, `moscowCol`, `teamCol`, `nameCol`, `krCol`, `epicLinkCol` — with each field a string (or `null` for `krCol`). The *values* of those keys may differ between **Sensible format** and **Quirky format** loads, but the *shape* is identical.

### Out of scope
- The **Content scan** itself — the regexes, the **Detection threshold**, and the column-iteration loop are owned by [feature 0002](./0002-content-based-column-detection.md). This feature only *changes the fallback path* and (for name and team) *prepends a direct header-name branch*; the content-scan loop is untouched.
- `parseCSV` and PapaParse integration. [Feature 0001](./0001-csv-upload-ui.md). This feature reads parsed rows; it does not own the parse.
- `loadInitiativesCSV` itself — the orchestration that calls the detectors in order and writes `detectedCols`. [Feature 0002](./0002-content-based-column-detection.md). This feature changes detector *internals*, not their *call order*.
- The **Column-detection debug** panel render in `renderPreview`. [Feature 0009](./0009-sidebar-preview-and-reference-panels.md). This feature does not change what the panel displays; it only changes which header names land in `detectedCols`.
- `normalizeMoscow` and `normalizeSize`. [Feature 0002](./0002-content-based-column-detection.md). The normalisers are format-agnostic; this feature does not touch them.
- The Epics CSV detection (`detectEpicLinkCol`). [Feature 0002](./0002-content-based-column-detection.md). The epic file has no **Sensible format**/**Quirky format** distinction in its link column.
- Constant Work CSV column detection. [Feature 0015](../../backtracked-features.md#0015). That CSV has fixed simple headers and does not go through the detector family.
- Schema validation, format-detection-error messaging, or any "this CSV is malformed" surface. The detectors are total; nothing in this feature surfaces a failure.
- A `format: 'sensible' | 'quirky'` discriminator (variable, enum, UI toggle, or any code surface). [ADR-0021](../adr/0021-sensible-csv-format-dual-support.md) is explicit that format is *emergent* from per-column detection and must not be reified.
- A migration tool to rewrite **Quirky format** CSVs into **Sensible format**. Both formats are first-class going forward.
- Per-column user overrides ("I know best, read column X as the Initiative key"). Future work; no UI hook in this feature.

## Relevant existing files
Claude may inspect:
- `index.html`, specifically:
  - The detector block (`index.html:1352-1493`): `detectInitKeyCol`, `detectMoscowCol`, `detectNameCol`, `detectTeamCol`, `detectKrCol`, `detectEpicLinkCol`, `normalizeMoscow`, `normalizeSize`.
  - `loadInitiativesCSV` (`index.html:1503-1516`) — the only call site for the Initiative-side detectors; reads each detector's return and spread-merges it into `detectedCols`.
  - `detectedCols` declaration (`index.html:1501`).
  - The **Column-detection debug** panel render inside `renderPreview` (`index.html:2841-2845`) — read-only consumer of `detectedCols`.
- `docs/plans/0002-content-based-column-detection.md` — the **Quirky format** detector behavior this feature extends. Acceptance scenarios there cover the **Content scan** path and the **Quirky format** loads; this plan adds the **Sensible format** scenarios.
- `docs/adr/0005-content-based-column-detection.md` — the parent architectural decision.
- `docs/adr/0021-sensible-csv-format-dual-support.md` — the architectural decision this feature implements.
- `CONTEXT.md` glossary — especially the **Sensible format** and **Quirky format** entries and the "Column detection" group.

Claude should not inspect unless needed:
- The Monte Carlo engine, charting, marker system, or projections — none of them care which CSV format produced `detectedCols`; they read row fields via the detected header names.
- `backtracked-features.md` — meta-index; not normative.

## Existing patterns to follow
- **Layering inside `index.html`**: detectors are module-scoped functions in Module 1 (CSV parsing). They remain *pure* (`rows → headerName`). All `console.log`, all writes to `detectedCols`, all side effects live one layer up in `loadInitiativesCSV`. Do not move logging or state mutation into a detector — even when adding the **Sensible format** branch.
- **Detector signature unchanged**: each detector still returns a *single header name string* (or `null` for `detectKrCol`). No detector returns a tuple or an object — the dual-format support does not change the return shape.
- **Per-detector branch ordering is intentional and asymmetric**: `detectNameCol` and `detectTeamCol` check the direct header *first*; `detectInitKeyCol` and `detectMoscowCol` check the direct header *last*. Do not unify these into a single ordering — see [ADR-0021](../adr/0021-sensible-csv-format-dual-support.md) for why.
- **No regex caching, no shared helper**: each detector compiles its regex inline. The cost is negligible and locality outweighs DRY at this scale.
- **State surfacing**: detected header names land on `detectedCols`, spread-merged on each load (`detectedCols = { ...(detectedCols || {}), initKeyCol, ... }`). Do not reset between loads — that would erase epic-side detections on a re-upload.
- **No framework**: vanilla DOM. The **Column-detection debug** panel is `<pre>` + `JSON.stringify`.
- **Verification command**: no automated test harness. Verification is manual: open `index.html` in a browser, upload **Sensible format** and **Quirky format** CSVs, observe the **Column-detection debug** panel.

> **Ubiquitous-language rule — applies to all sections from here down:**
> Every entity, field, and behavior name used in Data models, acceptance
> scenarios (Given/When/Then), Behavioral rules, and Invariants must match
> `CONTEXT.md` glossary terms verbatim. Do not introduce synonyms,
> abbreviations, or implementation-layer names that differ from the glossary.

## Data models

No persistence layer — this is a client-side-only app ([ADR-0002](../adr/0002-client-side-only.md)). In-memory state surfaced by this feature is identical to feature 0002:

```js
// Module-scoped, declared once near the top of Module 1.
let detectedCols = null; // { initKeyCol, moscowCol, teamCol, nameCol, krCol, epicLinkCol } | null
```

Each field is a string (the header name selected by the corresponding **Column detector**) except `krCol`, which is `null` when no Key Result column is present, and `epicLinkCol`, which is the sentinel `'(normalised→_initiative_key)'` after a successful epic load. *This feature does not change the shape of `detectedCols`.* What it changes is which header names *end up* in `initKeyCol`, `moscowCol`, `teamCol`, and `nameCol` for **Sensible format** loads.

The **Initiatives CSV** rows themselves are not mutated by this feature — detection still produces *names*, not value transformations.

---

## Phase 1: Sensible-format direct header matches for `detectInitKeyCol` and `detectMoscowCol`

### Acceptance behavior

Scenario AT-1: **Sensible format** — Initiative key found in `jira_key` by **Content scan**
Given the user uploads an Initiatives CSV with headers `[jira_key, building_block, moscow, teams, quarter]`
And the `jira_key` column's values are Jira keys like `INIT-200`, `INIT-201`
When `loadInitiativesCSV` parses the file
Then `detectedCols.initKeyCol === 'jira_key'`
(The **Content scan** wins here; the **Detection fallback** to `'jira_key'` is *not* exercised on this path.)

Scenario AT-2: **Sensible format** — Initiative key found by **Detection fallback** when the column values do not match the regex
Given the user uploads an Initiatives CSV with headers `[jira_key, building_block, moscow, teams, quarter]`
And the `jira_key` column's values are non-conforming (e.g. blank, free text, or formatted differently)
And no other column clears the **Detection threshold** `> 0.5`
When `loadInitiativesCSV` parses the file
Then `detectedCols.initKeyCol === 'jira_key'` (selected by **Detection fallback**, not by **Content scan**)
(The order is: content scan first; only if nothing wins does the fallback fire. The user gets the **Sensible format** header.)

Scenario AT-3: **Quirky format** — Initiative key found in `teams` by **Content scan** (regression-protect feature 0002)
Given the user uploads an Initiatives CSV with headers `[name, teams, emoji, team, quarter]`
And the `teams` column's values are Jira keys like `INIT-123`
When `loadInitiativesCSV` parses the file
Then `detectedCols.initKeyCol === 'teams'`
(Feature 0002 behavior — must not regress.)

Scenario AT-4: Neither format detectable — final fallback returns the **Quirky format** legacy default
Given the user uploads an Initiatives CSV where no column's values match the Jira-key regex above the **Detection threshold**
And the CSV has *neither* a `jira_key` *nor* a `teams` header
When `loadInitiativesCSV` parses the file
Then `detectedCols.initKeyCol === 'teams'` (the documented final fallback)
And no exception is thrown
(The `'teams'` final fallback is preserved for backwards compatibility — feature 0002 returned this; do not change it to `'jira_key'`.)

Scenario AT-5: Empty CSV — zero-rows return uses the **Sensible format** default
Given the user uploads an Initiatives CSV that parses to zero rows
When `loadInitiativesCSV` parses the file
Then `detectInitKeyCol([])` returns `'jira_key'`
And no exception is thrown
(Switched from the **Quirky format** default — see [ADR-0021](../adr/0021-sensible-csv-format-dual-support.md).)

Scenario AT-6: **Sensible format** — MoSCoW found in `moscow` by **Content scan**
Given the user uploads an Initiatives CSV with a `moscow` column holding values `must`, `should`, `could`
When `loadInitiativesCSV` parses the file
Then `detectedCols.moscowCol === 'moscow'`
(Content scan wins.)

Scenario AT-7: **Sensible format** — MoSCoW found by **Detection fallback** when values are sparse
Given the user uploads an Initiatives CSV where the `moscow` column has mostly empty cells (e.g. unset on draft initiatives)
And no other column clears the **Detection threshold** `> 0.5` for the MoSCoW keyword regex
When `loadInitiativesCSV` parses the file
Then `detectedCols.moscowCol === 'moscow'` (selected by **Detection fallback**)

Scenario AT-8: **Quirky format** — MoSCoW found in `emoji` by **Content scan** (regression-protect feature 0002)
Given the user uploads an Initiatives CSV with an `emoji` column holding `🔵 Should`, `🟢 Could`, `🔴 Must`
When `loadInitiativesCSV` parses the file
Then `detectedCols.moscowCol === 'emoji'`
(Feature 0002 behavior — must not regress.)

Scenario AT-9: Neither format detectable — final fallback returns the **Quirky format** legacy default
Given the user uploads an Initiatives CSV with no MoSCoW-shaped column and no `moscow` header
When `loadInitiativesCSV` parses the file
Then `detectedCols.moscowCol === 'emoji'` (the documented final fallback)

Scenario AT-10: Empty CSV — zero-rows MoSCoW return uses the **Sensible format** default
Given the user uploads a CSV that parses to zero rows
When `detectMoscowCol([])` runs
Then it returns `'moscow'` (switched from `'emoji'`)

### Public entry point

In-code:
- `detectInitKeyCol(rows)` (`index.html:1357`). Called once per Initiatives load from `loadInitiativesCSV` (`index.html:1506`).
- `detectMoscowCol(rows)` (`index.html:1376`). Called once per Initiatives load from `loadInitiativesCSV` (`index.html:1507`).

UI: the **Column-detection debug** panel's `<pre id="debug-pre">` after a successful load.

### Expected observable outcomes
- `detectedCols.initKeyCol` and `detectedCols.moscowCol` are strings equal to a header that exists in the parsed rows (or one of the documented fallbacks when the row set is empty or no content match wins).
- The **Column-detection debug** panel becomes visible after `renderPreview` runs and shows the selected headers under `Detected columns:`.
- The single `console.log` line `[Initiatives] N rows | key="<header>" | moscow="<header>" | team="<header>" | name="<header>" | kr="<header>"` is emitted at info level.
- A **Sensible format** load and a **Quirky format** load over the same logical data produce identical downstream **Run** results (same P50, same `P(effort > capacity)`).

### Test harness

Acceptance tests:
- Location: **N/A — manual.** This project has no automated test suite.
- Manual steps:
  1. Open `index.html` and upload a **Sensible format** Initiatives CSV. Confirm the debug panel reads `initKeyCol: "jira_key"`, `moscowCol: "moscow"`.
  2. Reload, upload a **Quirky format** Initiatives CSV. Confirm `initKeyCol: "teams"`, `moscowCol: "emoji"`.
  3. Reload, upload a **Sensible format** CSV whose `jira_key` column is blank. Confirm `initKeyCol: "jira_key"` (selected via **Detection fallback**, not via **Content scan**).
  4. Reload, upload a **Sensible format** CSV whose `moscow` column is sparse. Confirm `moscowCol: "moscow"`.
  5. Reload, upload a CSV with no Jira-key-shaped column *and* no `jira_key` header. Confirm `initKeyCol: "teams"`.
  6. Reload, upload a header-only CSV (zero data rows). Confirm `detectInitKeyCol` returns `'jira_key'` and `detectMoscowCol` returns `'moscow'`.
  7. From the DevTools console, call `detectInitKeyCol([])` and `detectMoscowCol([])` directly; confirm the zero-rows defaults.
  8. Run a **Sensible format** load and a **Quirky format** load of the same logical dataset; press **Run** for each; confirm the org-level P50 matches across both formats.

Inner tests: N/A.

Verification: manual.

Fake-injection wiring: N/A. Both detectors are pure; the only "external" input is the `rows` argument.

### Proposed implementation seams

Stable seams a future test suite may target:
- `detectInitKeyCol(rows: RowObject[]): string` — pure, returns a header name. Determined by `rows[0]`'s keys and the per-column match ratio, with **Sensible format** then **Quirky format** fallback.
- `detectMoscowCol(rows: RowObject[]): string` — pure, mirrors the above.
- The **Detection fallback** order: `'jira_key'` before `'teams'` for the Initiative key, `'moscow'` before `'emoji'` for MoSCoW.

Do NOT lock in:
- The exact regexes (`/^[A-Z][A-Z0-9_]+-\d+$/` for keys, `/must|should|could|won.t/i` for MoSCoW). Treat them as tunable.
- The **Detection threshold** values (`> 0.5`). Tunable.
- The zero-rows default values (`'jira_key'`, `'moscow'`). Tunable as the **Sensible format** evolves.

### Behavioral rule

For the Initiative key and MoSCoW columns, the **Column detector** runs the **Content scan** first; if a column clears the **Detection threshold**, that header wins. If no column wins, the detector falls back to the **Sensible format** header name (`'jira_key'` or `'moscow'`) when present in the parsed headers, and to the **Quirky format** header name (`'teams'` or `'emoji'`) otherwise. Empty inputs return the **Sensible format** default.

### Invariants
- Both detectors are *total functions*: they return a string for every input, including the empty-rows case.
- The returned header is one of: (a) a key of `rows[0]`, (b) the **Sensible format** fallback, or (c) the **Quirky format** fallback. Never a fabricated string.
- `detectInitKeyCol(rows)` and `detectMoscowCol(rows)` are deterministic — same `rows` ⇒ same return.
- The **Content scan** path is unchanged from feature 0002. A **Quirky format** CSV that worked before this feature must still produce the same detector output.
- The branch order inside both detectors is: **Content scan** → **Sensible format** header check → **Quirky format** header fallback. Not unified with `detectNameCol`/`detectTeamCol`'s order.

### Counterexamples (must NOT pass)
- A detector that checks `'jira_key'`/`'moscow'` *before* the **Content scan** — would silently misclassify a **Quirky format** CSV that happens to also have an empty `jira_key` column.
- A detector that returns `null` when no column matches — downstream code reads `row[initKeyCol]` and would silently produce `undefined`-keyed lookups everywhere.
- A detector that throws on empty rows — empty CSVs are a user-reachable state and must produce the zero-rows fallback.
- Removing the `'teams'`/`'emoji'` final fallback in favour of always returning the **Sensible format** default — would silently break the **Quirky format** path described in feature 0002 (the final fallback is the only thing keeping legacy headers from being misread when the **Content scan** also fails).
- Returning the **Quirky format** default for empty rows — the zero-rows default is explicitly switched to the **Sensible format** per [ADR-0021](../adr/0021-sensible-csv-format-dual-support.md).

### Forbidden shortcuts
- Do not introduce a `format: 'sensible' | 'quirky'` enum at the top of `loadInitiativesCSV` and branch the detectors on it. Format is per-column and emergent ([ADR-0021](../adr/0021-sensible-csv-format-dual-support.md)).
- Do not refactor the **Content scan** loop into a shared helper just to centralise the regex. Per-detector locality is intentional.
- Do not change the branch *order* in `detectInitKeyCol`/`detectMoscowCol` to put the header-name check first. The **Content scan**-first order is load-bearing — see [ADR-0021](../adr/0021-sensible-csv-format-dual-support.md).
- Do not normalise headers (e.g. lowercasing) before the **Sensible format** check. PapaParse preserves the user's casing; the detector compares strings byte-for-byte against `'jira_key'` and `'moscow'`, both lowercase by convention.

### RED gate

On an unimplemented build (detectors unchanged from feature 0002 — content scan + a single legacy fallback):
- Manual step 1 (**Sensible format** with a blank `jira_key` column): `detectedCols.initKeyCol === 'teams'` (the only fallback feature 0002 had), and downstream code reads from the wrong column.
- Manual step 6 (header-only CSV): `detectInitKeyCol([])` returns `'teams'` instead of `'jira_key'`.

### Test immutability rule

There are no test files to freeze (manual harness). If a test suite is later introduced for these detectors, those tests would live under `tests/acceptance/` and be off-limits to the implementation session.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-10 all pass in a fresh browser tab.
- [ ] Both **Sensible format** and **Quirky format** loads produce identical downstream **Run** results.
- [ ] The **Content scan**-first order in `detectInitKeyCol`/`detectMoscowCol` is preserved.
- [ ] The zero-rows defaults are `'jira_key'` and `'moscow'`.
- [ ] `git diff` touches only `index.html` (plus this plan, the ADR, and CONTEXT.md per [ADR-0001](../adr/0001-single-file-html-app.md)).

---

## Phase 2: Sensible-format direct header matches for `detectNameCol` and `detectTeamCol`

### Acceptance behavior

Scenario AT-1: **Sensible format** — Initiative name read from `building_block` by *direct header-name match*
Given the user uploads an Initiatives CSV with headers `[jira_key, building_block, moscow, teams, quarter]`
When `loadInitiativesCSV` parses the file
Then `detectedCols.nameCol === 'building_block'` (selected by the direct header match, *not* by positional inference)
And the **Data preview** and **Initiative matrix** show initiative names from the `building_block` column

Scenario AT-2: **Sensible format** — team read from `teams` by *direct header-name match*
Given the user uploads an Initiatives CSV with headers `[jira_key, building_block, moscow, teams, quarter]`
When `loadInitiativesCSV` parses the file
Then `detectedCols.teamCol === 'teams'` (selected by the direct header match)
And the **Team Level tab** and **Team Projections tab** group initiatives by the `teams` column

Scenario AT-3: **Quirky format** — Initiative name read from the column *before* the detected `initKeyCol` (positional fallback)
Given the user uploads an Initiatives CSV with headers `[name, teams, emoji, team, quarter]` (Quirky — `teams` holds Jira keys)
And `detectedCols.initKeyCol === 'teams'` (from Phase 1)
And there is *no* `building_block` header in the CSV
When `loadInitiativesCSV` parses the file
Then `detectedCols.nameCol === 'name'` (the header at index `headers.indexOf('teams') - 1`)

Scenario AT-4: **Quirky format** — team read from the column *before* the detected `moscowCol` (positional fallback)
Given the user uploads an Initiatives CSV with headers `[name, teams, emoji, team, quarter]`
And `detectedCols.moscowCol === 'emoji'` (from Phase 1)
And there is *no* `teams` header *that is distinct from the Initiative key column* — i.e. `teams` *is* `initKeyCol` here
When `loadInitiativesCSV` parses the file
Then `detectedCols.teamCol === 'team'` (the header at `headers.indexOf('emoji') - 1`)
(The positional fallback's `candidate !== initKeyColHeader` guard prevents the team column from collapsing onto the Initiative key column.)

Scenario AT-5: Positional fallback's guard fires when the candidate is the Initiative key column
Given the user uploads a degenerate CSV where the column immediately before the MoSCoW column *is* the Initiative key column (e.g. headers `[jira_key, moscow, ...]` with no `teams` header)
And `detectedCols.initKeyCol === 'jira_key'`
And `detectedCols.moscowCol === 'moscow'`
When `loadInitiativesCSV` parses the file
Then `detectedCols.teamCol === 'teams'` (the final fallback — the guard `candidate !== initKeyColHeader` rejects `'jira_key'`)
And `teamCol !== initKeyCol` (the feature-0002 invariant is preserved)

Scenario AT-6: Hybrid CSV — `building_block` present but no `teams` header
Given the user uploads an Initiatives CSV with headers `[jira_key, building_block, moscow, team_owner, quarter]`
When `loadInitiativesCSV` parses the file
Then `detectedCols.nameCol === 'building_block'` (direct match wins)
And `detectedCols.teamCol === 'team_owner'` (positional fallback — header before `moscow`)
(Each column is independently detected; there is no CSV-level format flag.)

Scenario AT-7: Hybrid CSV — `teams` present but no `building_block` header
Given the user uploads an Initiatives CSV with headers `[jira_key, initiative_label, moscow, teams, quarter]`
When `loadInitiativesCSV` parses the file
Then `detectedCols.teamCol === 'teams'` (direct match wins)
And `detectedCols.nameCol === 'initiative_label'` (positional fallback — header before `jira_key`)

Scenario AT-8: Initiative-key column at position 0 — name positional fallback would underflow; final fallback fires
Given the user uploads a CSV with headers `[jira_key, moscow, teams, quarter]` (key column is first)
And there is no `building_block` header
When `loadInitiativesCSV` parses the file
Then `detectNameCol([...], 'jira_key')` returns `'building_block'` (final fallback — `indexOf('jira_key') === 0`, so `idx > 0` is false)
(The detector does not return `headers[-1]` or `undefined`.)

Scenario AT-9: MoSCoW column at position 0 — team positional fallback fires the final fallback
Given the user uploads a CSV with headers `[moscow, jira_key, teams, ...]` where `moscow` is first
When `loadInitiativesCSV` parses the file
Then `detectTeamCol([...], 'jira_key', 'moscow')` returns `'teams'` if present, else the final `'teams'` fallback
(The positional fallback requires `moscowIdx > 0`; otherwise the final fallback fires.)

Scenario AT-10: Empty CSV — both detectors return the **Sensible format** defaults
Given `detectNameCol([], anyHeader)` is called
Then it returns `'building_block'`
Given `detectTeamCol([], anyKey, anyMoscow)` is called
Then it returns `'teams'`

Scenario AT-11: Direct header match takes precedence over positional inference (regression-guard for [ADR-0021](../adr/0021-sensible-csv-format-dual-support.md))
Given the user uploads a **Sensible format** CSV where the column immediately before `jira_key` is *not* `building_block` (e.g. headers `[notes, building_block, jira_key, moscow, teams, quarter]`)
When `loadInitiativesCSV` parses the file
Then `detectedCols.nameCol === 'building_block'` (the direct header match wins; positional would have returned `'building_block'` here too, but the same is true when positional would have returned `'notes'`)
And similarly, with headers `[jira_key, notes, building_block, moscow, teams, quarter]`, `nameCol === 'building_block'` (direct match wins over positional which would have returned `'notes'`)

### Public entry point

In-code:
- `detectNameCol(rows, initKeyColHeader)` (`index.html:1396`). Called once per Initiatives load from `loadInitiativesCSV` (`index.html:1509`); takes the result of `detectInitKeyCol` so the positional fallback can compute its offset.
- `detectTeamCol(rows, initKeyColHeader, moscowColHeader)` (`index.html:1416`). Called once per Initiatives load from `loadInitiativesCSV` (`index.html:1508`); takes both prior detector results so the positional fallback and the anti-collision guard can fire.

UI: the **Column-detection debug** panel's `<pre id="debug-pre">`; downstream — the **Data preview**'s initiative-name display and the **Team Level tab** / **Team Projections tab** team groupings.

### Expected observable outcomes
- `detectedCols.nameCol` is a string equal to either `'building_block'` or one of the parsed headers; never `undefined`, never `null`.
- `detectedCols.teamCol` is a string equal to either `'teams'`, the positional-fallback header, or `'teams'` as the final fallback; never equal to `detectedCols.initKeyCol`.
- A **Sensible format** load shows `nameCol: "building_block"` and `teamCol: "teams"` in the **Column-detection debug** panel regardless of column reordering in the CSV (the direct header match is order-independent).
- A **Quirky format** load shows the positional-inferred headers, unchanged from feature 0002 behavior.

### Test harness

Acceptance tests:
- Location: **N/A — manual.**
- Manual steps:
  1. Upload a **Sensible format** CSV. Confirm the debug panel reads `nameCol: "building_block"`, `teamCol: "teams"`.
  2. Reload, upload a **Quirky format** CSV. Confirm `nameCol` matches the header before `initKeyCol` (e.g. `"name"`), `teamCol` matches the header before `moscowCol` (e.g. `"team"`).
  3. Construct a **Sensible format** CSV with deliberately reordered columns (e.g. put `building_block` *before* `jira_key`). Confirm `nameCol === 'building_block'` — the direct match is order-independent.
  4. Construct a hybrid CSV with `jira_key` and `moscow` (Sensible) but `team_owner` for the team. Confirm `teamCol === 'team_owner'` (positional fallback).
  5. Construct a hybrid CSV with `jira_key` and `building_block` (Sensible) but `emoji` for MoSCoW. Confirm `nameCol === 'building_block'` (direct match wins).
  6. Construct a degenerate CSV where the column before `moscowCol` *is* `initKeyCol`. Confirm `detectedCols.teamCol === 'teams'` (final fallback fires; `teamCol !== initKeyCol`).
  7. Construct a header-only CSV (zero data rows). Confirm `detectNameCol` returns `'building_block'` and `detectTeamCol` returns `'teams'`.
  8. From DevTools, call `detectNameCol([], 'anything')` and `detectTeamCol([], 'a', 'b')`; confirm the **Sensible format** defaults.
  9. With both formats loaded sequentially, run the simulation on the same logical data; confirm the **Team Level tab** sections and the **Data preview** initiative names match across formats.

Inner tests: N/A.

Verification: manual.

Fake-injection wiring: N/A. Pure detectors, take `rows` and the prior detector outputs as arguments.

### Proposed implementation seams

Stable seams:
- `detectNameCol(rows, initKeyColHeader): string` — pure, branches: direct `building_block` match → positional fallback → final `'building_block'`.
- `detectTeamCol(rows, initKeyColHeader, moscowColHeader): string` — pure, branches: direct `teams` match → positional fallback (with `candidate !== initKeyColHeader` guard) → final `'teams'`.
- The direct-match-first ordering inside both detectors.
- The `teamCol !== initKeyCol` invariant (enforced by the guard inside the positional fallback).

Do NOT lock in:
- The exact list of direct-match headers (`['building_block']` for name, `['teams']` for team). A future revision may add synonyms.
- The positional-inference rule (the header at `indexOf(initKeyColHeader) - 1` for name; the header at `indexOf(moscowColHeader) - 1` for team). Tunable.
- The final-fallback values (`'building_block'`, `'teams'`). Tunable as the **Sensible format** evolves.

### Behavioral rule

For the name and team columns, the **Column detector** checks for the **Sensible format** header (`building_block`, `teams`) *first* — a direct, order-independent match. Only when that header is absent does the detector fall back to *positional inference* — the legacy **Quirky format** behavior — reading the header immediately before `initKeyColHeader` (for name) or `moscowColHeader` (for team), guarded by the `teamCol !== initKeyCol` invariant. When the positional fallback cannot apply (the reference column is at index `0`, or the candidate would equal the Initiative key column), the detector returns the **Sensible format** default (`'building_block'`, `'teams'`).

### Invariants
- `detectNameCol(rows, initKeyColHeader)` is total: returns a string for every input.
- `detectTeamCol(rows, initKeyColHeader, moscowColHeader)` is total.
- The direct header-name check is *first* in both detectors — see [ADR-0021](../adr/0021-sensible-csv-format-dual-support.md). Branch order is the contract; do not reorder.
- The `candidate !== initKeyColHeader` guard inside `detectTeamCol`'s positional fallback enforces `detectedCols.teamCol !== detectedCols.initKeyCol`.
- Both detectors are deterministic.
- The zero-rows return is `'building_block'` for name and `'teams'` for team.

### Counterexamples (must NOT pass)
- A `detectNameCol` that runs the positional fallback *before* the direct `building_block` match — would silently misread the name column when the user reorders columns in a **Sensible format** CSV.
- A `detectTeamCol` that omits the `candidate !== initKeyColHeader` guard — would let the team column collapse onto the Initiative key column on degenerate CSVs.
- A detector that returns `headers[-1]` (i.e. fails to guard against `idx === 0`) — would yield `undefined` and crash downstream consumers.
- A detector that mutates `rows` (e.g. trims values in place) — must be a pure read.
- A detector that throws on empty rows — empty CSVs are a user-reachable state.
- A `detectNameCol` that always returns `'building_block'` regardless of the parsed headers — would silently break every **Quirky format** load (the positional fallback is the only thing carrying those CSVs).
- A `detectTeamCol` that uses `headers.includes('teams')` *after* the positional fallback — would let the positional inference fire on a **Sensible format** CSV with reordered columns, defeating the order-independence the direct match provides.

### Forbidden shortcuts
- Do not introduce a "CSV format" enum and branch detectors on it. Format is per-column and emergent ([ADR-0021](../adr/0021-sensible-csv-format-dual-support.md)).
- Do not couple `detectNameCol` and `detectTeamCol` into a single function. The two detectors have different reference columns (`initKeyCol` vs `moscowCol`) and the team detector has the extra `!== initKeyCol` guard — fusing them obscures both.
- Do not log `nameCol` / `teamCol` from inside the detectors. The single `console.log` line lives in `loadInitiativesCSV`.
- Do not strip whitespace from header names. PapaParse already normalises that; the detector compares against the raw header strings.
- Do not lower-case the header before checking `headers.includes('building_block')` / `headers.includes('teams')`. The **Sensible format** uses lowercase headers by convention; case-folding would mask user typos that should be debugged via the **Column-detection debug** panel.

### RED gate

On an unimplemented build (detectors at feature-0002-only behavior — pure positional fallback):
- Manual step 1 (**Sensible format** load): `nameCol` matches whatever header sits before `jira_key` (e.g. `nothing` or the first column), not `'building_block'`; `teamCol` matches whatever header sits before `moscow`, not `'teams'`.
- Manual step 3 (reordered **Sensible format**): `nameCol` is wrong because the positional fallback fires on the unexpected layout.
- Manual step 6 (degenerate header order): `teamCol === initKeyCol`, violating the invariant.
- Manual step 7 (empty CSV): the detector may return `undefined` or throw.

### Test immutability rule

N/A.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-11 all pass.
- [ ] **Sensible format** loads show `nameCol === 'building_block'` and `teamCol === 'teams'` regardless of column order.
- [ ] **Quirky format** loads behave identically to feature 0002 (positional fallback fires; same headers selected).
- [ ] The `teamCol !== initKeyCol` invariant holds on every load (including degenerate cases).
- [ ] Empty-rows defaults are `'building_block'` and `'teams'`.
- [ ] `git diff` touches only `index.html` (plus this plan, the ADR, and CONTEXT.md).

---

## Phase 3: Cross-detector integration — both formats round-trip identically

### Acceptance behavior

Scenario AT-1: A **Sensible format** load and a **Quirky format** load of the same logical data produce identical **Run** outputs
Given two CSVs encoding the same logical Initiatives (same Jira keys, names, MoSCoW priorities, teams, quarters), one in **Sensible format** and one in **Quirky format**
And the same Epics CSV in both runs
And the same **Historical quarter** and **Target quarter** selections
When `Run Simulation` is pressed for each load
Then the org-level P50, P75, P90, mean, and `P(effort > capacity)` match across the two formats
(Bit-for-bit equality is *not* required — the PRNG is reseeded each Run — but the percentile values should match to within Monte Carlo noise at 10k iterations.)

Scenario AT-2: The **Column-detection debug** panel surfaces the format-specific headers
Given a **Sensible format** load has just completed
When the user expands the **Column-detection debug** panel
Then the `Detected columns:` JSON shows `initKeyCol: "jira_key"`, `moscowCol: "moscow"`, `teamCol: "teams"`, `nameCol: "building_block"`
Given a **Quirky format** load has just completed
When the user expands the **Column-detection debug** panel
Then the JSON shows the **Quirky format** headers (e.g. `initKeyCol: "teams"`, `moscowCol: "emoji"`, `teamCol: "team"`, `nameCol: "name"`)

Scenario AT-3: Subsequent re-uploads update `detectedCols` without leaking the previous format's headers
Given a **Sensible format** CSV was just loaded
When the user uploads a **Quirky format** CSV on top
Then `detectedCols` reflects the **Quirky format** headers for all four columns
And no **Sensible format** header (`'jira_key'`, `'building_block'`, `'moscow'`, `'teams'`) appears in `detectedCols` unless the **Quirky format** CSV also has those headers
(The spread-merge in `loadInitiativesCSV` overwrites every key on each load.)

Scenario AT-4: `detectedCols.krCol` and `detectedCols.epicLinkCol` are unaffected by format
Given a **Sensible format** load has just completed
And a **Quirky format** load has just completed (separately)
When the **Column-detection debug** panel is inspected after each
Then `krCol` is detected by header-variant lookup, independently of format
And `epicLinkCol === '(normalised→_initiative_key)'` after either format's epic load
(These two detectors did not change in this feature.)

Scenario AT-5: Downstream consumers do not care about format
Given a load has completed (either format)
When `prepareSimulationData`, `prepareTeamSimulationData`, `buildTeamProjections`, or `renderInitiativesTable` runs
Then each reads `row[detectedCols.xxxCol]` and produces values consistent with the loaded data
And no downstream function inspects the headers to "detect" the format
(There is no `format === 'sensible'` branch anywhere in the codebase.)

Scenario AT-6: The simulator never asks the user which format the CSV is
Given the sidebar UI is inspected
When the user is preparing to upload
Then there is no radio button, dropdown, or checkbox asking "Sensible format / Quirky format"
And the upload control is the same single file input that feature 0001 introduced
(Format is unobservable through the UI controls — it is only observable through the **Column-detection debug** panel after a load.)

### Public entry point

This phase has no new code surface. It is a *behavioral* gate covering the integration of Phase 1 and Phase 2 with the existing simulator pipeline.

UI: the **Column-detection debug** panel (read-only consumer); the **Data preview** (read-only consumer); the **Run** button (triggers downstream consumers).

### Expected observable outcomes
- Both formats produce a populated `detectedCols` with the same six keys.
- A round-trip **Sensible format** load → **Quirky format** load → **Sensible format** load shows `detectedCols` updated on each load with no key carry-over.
- The simulator's Run outputs match across formats for the same logical dataset.

### Test harness

Acceptance tests:
- Location: **N/A — manual.**
- Manual steps:
  1. Prepare two CSV pairs that encode the same logical data — one in **Sensible format**, one in **Quirky format**.
  2. Upload the **Sensible format** pair; press **Run**; note the org-level P50, P75, P90, mean, `P(effort > capacity)`.
  3. Reload the page (or use the per-file ✕ Remove buttons), upload the **Quirky format** pair; press **Run**; note the same statistics.
  4. Verify the statistics match to within Monte Carlo noise at the default iteration count.
  5. Re-upload alternating formats; confirm `detectedCols` updates on each load without stale keys.
  6. Inspect the simulator's UI for any format-related control; confirm there is none.
  7. Grep the codebase for `'sensible'` / `'quirky'` outside of comments, documentation, and the **Column-detection debug** panel; confirm there is no enum, no branch, no variable carrying a format flag.

Inner tests: N/A.

Verification: manual.

Fake-injection wiring: N/A.

### Proposed implementation seams

Stable seams:
- The full `detectedCols` shape is the public contract between the detectors and every downstream reader.
- `loadInitiativesCSV` is the *only* writer of `detectedCols` for the Initiative-side fields.
- The **Column-detection debug** panel is the *only* user-visible surface for the per-column detector outcomes.

Do NOT lock in:
- The presence of *exactly* two formats. A future revision may add a third format with its own direct-match headers ([ADR-0021](../adr/0021-sensible-csv-format-dual-support.md)).
- The specific equality of P50 across formats — they are sampled from the same distribution but with different PRNG seeds.

### Behavioral rule

The **Sensible format** and **Quirky format** are both first-class inputs to the simulator. Each load produces a fresh `detectedCols` whose values reflect the per-column detector outcomes for *that* load. Downstream consumers never branch on format; they read header names from `detectedCols` and trust the detectors. The user never tells the simulator which format their CSV is.

### Invariants
- After every `loadInitiativesCSV` call, `detectedCols` contains all six keys (`initKeyCol`, `moscowCol`, `teamCol`, `nameCol`, `krCol`, `epicLinkCol`), each a string except `krCol` which may be `null`.
- `detectedCols.teamCol !== detectedCols.initKeyCol`.
- The same logical Initiative data, encoded in either format, produces identical downstream **Run** outputs to within Monte Carlo noise.
- The **Sensible format** and **Quirky format** identifiers do not appear as enum values, variable names, or branch keys anywhere in `index.html`. They are documentation-only terms ([ADR-0021](../adr/0021-sensible-csv-format-dual-support.md)).
- The **Column-detection debug** panel is the *single* user-visible surface for format awareness; no other UI control reveals which format was detected.

### Counterexamples (must NOT pass)
- A `loadInitiativesCSV` that reads the *previous* load's `detectedCols.initKeyCol` instead of calling `detectInitKeyCol` fresh — would carry stale **Sensible format** keys across a subsequent **Quirky format** load.
- A downstream consumer that special-cases `if (detectedCols.initKeyCol === 'jira_key') { ... } else { ... }` — duplicates the format awareness that `detectedCols` is meant to encapsulate.
- A UI element that lets the user pick the format. The detectors must own the decision.
- An assertion that the two formats produce *bit-identical* Run outputs. The PRNG seed differs per Run; only the statistics match (to within Monte Carlo noise).
- A grep-visible `format = 'sensible'` or `format = 'quirky'` enum.

### Forbidden shortcuts
- Do not introduce a top-level `csvFormat` variable, even as a debug aid.
- Do not memoise `detectedCols` across loads. Every load must recompute every detector output.
- Do not let downstream consumers cache header names locally; they must read `detectedCols` on every access.
- Do not write a "format converter" that rewrites a **Quirky format** CSV into **Sensible format** before parsing. Both formats live together; conversion is not the simulator's job.

### RED gate

On an unimplemented build (Phase 1 and Phase 2 not landed):
- Manual step 2/3 (Sensible vs Quirky Run comparison): the **Sensible format** load misclassifies one of the four columns (most likely `nameCol` or `teamCol` via positional fallback against an unexpected layout), and the org-level P50 diverges materially across the two loads — beyond Monte Carlo noise — because different initiative names or team groupings are being read.
- Manual step 5 (alternating uploads): the **Column-detection debug** panel shows stale keys from the previous format.

### Test immutability rule

N/A.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-6 all pass.
- [ ] Both formats produce identical org-level **Run** outputs for the same logical data.
- [ ] `detectedCols` is refreshed in full on every load.
- [ ] The **Column-detection debug** panel is the only format-aware UI surface.
- [ ] No `'sensible'` / `'quirky'` enum, variable, or branch exists in `index.html`.
- [ ] `git diff` touches only `index.html`, `docs/plans/0013-sensible-csv-format-support.md`, `docs/adr/0021-sensible-csv-format-dual-support.md`, and `CONTEXT.md` (per [ADR-0001](../adr/0001-single-file-html-app.md)).
