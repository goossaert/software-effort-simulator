# Feature: Content-based CSV column auto-detection

Created at: 2026-05-20T22:50:00Z

## Context

This feature sits directly downstream of feature [0001 — CSV upload UI](./0001-csv-upload-ui.md): once a CSV's rows are in memory, *something* has to translate the user's arbitrary headers into the semantic columns the rest of the app depends on (Initiative key, MoSCoW priority, team, name, Epic→Initiative link, Key Result). This feature is that translator.

Relevant cross-cutting decisions:
- [ADR-0001 — Single-file HTML app, no build step](../adr/0001-single-file-html-app.md). All detectors live as module-scoped functions inside `index.html`; no shared utility module exists.
- [ADR-0003 — CSV as the input format](../adr/0003-csv-input-format.md). Because we accept any tool's CSV, we cannot dictate header names.
- [ADR-0004 — Two-file Initiative/Epic model](../adr/0004-two-file-initiative-epic-model.md). The Initiative-side and Epic-side detectors run at different times against different files.
- [ADR-0005 — Content-based column detection over header-name matching](../adr/0005-content-based-column-detection.md). This is the architectural decision that this feature implements.

Glossary terms used below: **Initiative**, **Epic**, **Initiative key**, **MoSCoW**, **T-shirt size**, **Sensible format**, **Quirky format**, **Column detector**, **Content scan**, **Detection threshold**, **Detection fallback**, **Recognised t-shirt size** (see [CONTEXT.md](../../CONTEXT.md)).

## User-visible behavior

A user who uploads a CSV exported from the legacy internal tool — where the column literally named `teams` holds Jira keys (`INIT-123`) and the column literally named `emoji` holds MoSCoW priority strings (`🔵 Should`) — sees the app load the file without complaint. The sidebar data preview shows the correct Initiative count, Poisson λ, and MoSCoW breakdown; running the simulation produces results identical to what the user would get from a hand-renamed **Sensible format** version of the same data. A user uploading a **Sensible format** CSV (`jira_key`, `moscow`, `building_block`, `teams`) sees the same thing — both formats work without configuration.

After both CSVs are loaded, a collapsible "Column detection debug" panel appears in the sidebar, showing a JSON dump of which header was selected for each semantic column. This is the only user-facing surface that exposes detection decisions; it is the user's tool for diagnosing a misdetection.

Detection never fails noisily. If a column cannot be content-detected (empty CSV, or no column clears the **Detection threshold**), the detector returns a **Detection fallback** header name; if that header is also absent, downstream code reads `undefined` and the row contributes nothing (e.g. an unparseable MoSCoW becomes the `unknown` bucket, which is excluded from every **Scenario**).

## Scope

### In scope
- Five **Column detectors** for the Initiatives CSV: `detectInitKeyCol`, `detectMoscowCol`, `detectNameCol`, `detectTeamCol`, `detectKrCol`.
- One **Column detector** for the Epics CSV: `detectEpicLinkCol`.
- Two normalisers that complete the detected-value pipeline: `normalizeMoscow` (handles emoji-prefixed values, case-insensitive keyword match) and `normalizeSize` (uppercase + trim).
- Storing the detected header names on the module-scoped `detectedCols` object so the debug panel and downstream consumers can read them.
- The "Column detection debug" `<details>` panel (`#debug-details` / `#debug-pre`) that exposes `detectedCols` after a successful preview render.

### Out of scope
- The CSV upload affordance itself (feature 0001).
- Quarter extraction and the multi-quarter selector (feature 0010).
- Any rendering of *values* read via the detected columns — that belongs to whichever downstream feature consumes them (preview render, run, projections).
- Constant Work CSV column detection (feature 0015) — that file has fixed, simpler headers and does not use the detector family.
- Schema validation or "good-CSV vs bad-CSV" messaging. There is no validator; rows that don't yield usable values simply produce zero contribution.
- Per-column user override (a future "I know best, use this column" picker). The current product accepts the auto-detection or asks the user to rename headers.

## Relevant existing files
Claude may inspect:
- `index.html`, specifically:
  - The detector block (`index.html:1352-1493`): `parseCSV`, `detectInitKeyCol`, `detectMoscowCol`, `detectNameCol`, `detectTeamCol`, `detectKrCol`, `detectEpicLinkCol`, `normalizeMoscow`, `normalizeSize`.
  - `loadInitiativesCSV` (`index.html:1503-1516`) — the only call site for the Initiative-side detectors.
  - `loadEpicsFile` (`index.html:1554-1601`) — the only call site for `detectEpicLinkCol`; also reads `_tshirt_size` via per-row column-name variants (not a detector — see *Out of scope for this phase*).
  - `detectedCols` declaration (`index.html:1501`) and the debug-panel render in `renderPreview` (`index.html:2841-2845`).
  - The debug-panel markup (`index.html:951-957`).
- `CONTEXT.md` glossary, especially the "Column detection" group.
- ADR-0003 and ADR-0005 for the constraints these detectors must respect.

Claude should not inspect unless needed:
- The Monte Carlo engine, charting, marker system, or projections — none of them read `detectedCols`; they read row fields via the headers it stores.
- `backtracked-features.md` — that file is the meta-index of features and is not normative.

## Existing patterns to follow
- **Layering inside `index.html`**: detectors live in Module 1 (CSV parsing). They are pure functions: `(rows) → headerName`. Side effects (`console.log`, mutating `detectedCols`) live one layer up in `loadInitiativesCSV` / `loadEpicsFile`. Do not move logging or state mutation into a detector.
- **Detector signature**: each detector returns a *single header name string*. Even when detection fails, the return value is a string — the **Detection fallback** name. Callers do not branch on a `null`/`undefined` return.
- **Two-step strategy**: every detector implements either (content scan → header-name fallback) or (header-name heuristic → content scan → final fallback). The order is intentional and per-detector; do not unify them.
- **No regex caching**: detectors compile their regex inline (e.g. `const RE = /^[A-Z][A-Z0-9_]+-\d+$/`). The cost is negligible at our row scales and locality outweighs DRY.
- **State surfacing**: detected header names land on `detectedCols`, a single module-scoped object spread-merged on each load (`detectedCols = { ...(detectedCols || {}), initKeyCol, ... }`). Do not reset it between loads — that would erase epic-side detections when the user re-uploads initiatives.
- **No framework**: vanilla DOM. The debug panel is `<pre>` + `JSON.stringify`. No syntax highlighting, no React.
- **Verification command**: no automated test harness. Verification is manual: open `index.html` in a browser, upload the two formats, observe the debug panel and the preview values.

> **Ubiquitous-language rule — applies to all sections from here down:**
> Every entity, field, and behavior name used in Data models, acceptance
> scenarios (Given/When/Then), Behavioral rules, and Invariants must match
> `CONTEXT.md` glossary terms verbatim. Do not introduce synonyms,
> abbreviations, or implementation-layer names that differ from the glossary.

## Data models

No persistence layer — this is a client-side-only app (ADR-0002). In-memory state populated by this feature:

```js
// Module-scoped, declared once near the top of Module 1.
let detectedCols = null;   // { initKeyCol, moscowCol, teamCol, nameCol, krCol, epicLinkCol } | null
```

Each field is a string (the header name selected by the corresponding detector) except `krCol`, which is `null` when no Key Result column is present, and `epicLinkCol`, which after a successful epic load is replaced by the sentinel `'(normalised→_initiative_key)'` to signal that downstream code should read `row._initiative_key`, not `row[epicLinkCol]`.

`detectedCols` is the single source of truth for "which header carries which semantic column" and is consumed by:
- the debug panel render in `renderPreview` (`index.html:2843`);
- `prepareSimulationData` and friends, via destructure from `detectedCols`.

Initiative rows themselves are not mutated by this feature — detection produces *names*, not value transformations. (Compare with feature 0001's Epic rows, which gain synthetic `_initiative_key`, `_tshirt_size`, `_quarter`, `_epic_key` fields. Those mutations belong to feature 0001's loader; the names that drive them — like the link column — come from this feature.)

---

## Phase 1: Initiative-key column is detected by content, not by header name

### Acceptance behavior

Scenario AT-1: Quirky format — Initiative key found in the `teams` column
Given the user uploads an Initiatives CSV with headers `[name, teams, emoji, team, quarter]`
And the `teams` column's values are Jira keys like `INIT-123`, `INIT-124`, `INIT-125`
When `loadInitiativesCSV` parses the file
Then `detectedCols.initKeyCol === 'teams'`
And the column detection debug panel becomes visible and its JSON shows `"initKeyCol": "teams"`

Scenario AT-2: Sensible format — Initiative key found in `jira_key` by content scan
Given the user uploads an Initiatives CSV with headers `[jira_key, building_block, moscow, teams, quarter]`
And the `jira_key` column's values are Jira keys like `INIT-200`, `INIT-201`
When `loadInitiativesCSV` parses the file
Then `detectedCols.initKeyCol === 'jira_key'`
(Note: the content scan wins here; the header-name fallback is not exercised.)

Scenario AT-3: No content match — Detection fallback returns `jira_key` when present, else `teams`
Given the user uploads an Initiatives CSV where no column's values match the Jira-key regex above the **Detection threshold** (`> 0.5`)
And the CSV has a `jira_key` header (whose values are e.g. blank or free text)
When `loadInitiativesCSV` parses the file
Then `detectedCols.initKeyCol === 'jira_key'`
And if the CSV has neither a Jira-key-shaped column nor a `jira_key` header, `detectedCols.initKeyCol === 'teams'` (the legacy fallback)

Scenario AT-4: Empty CSV — Detection fallback returns the legacy default
Given the user uploads a CSV that parses to zero rows
When `loadInitiativesCSV` runs
Then `detectInitKeyCol` returns `'jira_key'` (the documented zero-rows default)
And no exception is thrown

### Public entry point

In-code: `detectInitKeyCol(rows)` (`index.html:1357`). Called once per Initiatives load, from `loadInitiativesCSV` (`index.html:1506`).

UI: the entry point user-side is the Initiatives CSV upload control (covered by feature 0001); the observable surface for this phase is the debug panel `<pre id="debug-pre">` after a successful load.

### Expected observable outcomes
- `detectedCols.initKeyCol` is a string equal to a header that exists in the parsed rows (or the documented fallback when rows are empty).
- The debug panel becomes visible after `renderPreview` runs and contains a JSON line `"initKeyCol": "<header>"`.
- No console errors. A single `console.log` line of the form `[Initiatives] N rows | key="<header>" | …` is emitted at info level.
- The Initiative key column choice is *stable* under reload of the same file (the iteration order of `Object.keys(rows[0])` is the parse order, which PapaParse preserves).

### Test harness

Acceptance tests:
- Location: **N/A — manual.** This project has no automated test suite.
- Manual steps:
  1. Open `index.html` and upload a Quirky-format Initiatives CSV (the canonical legacy export). Confirm the debug panel's `initKeyCol` reads `teams`.
  2. Reload, upload a Sensible-format Initiatives CSV. Confirm `initKeyCol` reads `jira_key`.
  3. Reload, upload a CSV whose `jira_key` column is blank (force the fallback path). Confirm `initKeyCol` still reads `jira_key`.
  4. Reload, upload a header-only CSV (zero data rows). Confirm `initKeyCol` reads `jira_key` and no error appears in the console.

Inner tests:
- Location: **N/A — no test harness.** If one is added later, the natural seam is `detectInitKeyCol(rows)`, which is pure and trivially fuzzable.

Verification:
- Manual: `open index.html` (macOS) and walk the steps. Use Chrome DevTools (Console / Sources) to inspect `detectedCols`.

Fake-injection wiring:
- N/A. The detector is pure; the only "external" input is its `rows` argument.

### Proposed implementation seams

Stable seams a future test suite may target:
- `detectInitKeyCol(rows: RowObject[]): string` — pure, returns a header name. Determined entirely by `rows[0]`'s keys and the per-column match ratio.
- `detectedCols` (module-scoped object) — readable from the debug panel and from `prepareSimulationData`.

Do NOT lock in:
- The exact value of the **Detection threshold** (currently `> 0.5`). Treat it as a tunable.
- The regex literal (currently `/^[A-Z][A-Z0-9_]+-\d+$/`). It may evolve to accept lowercase or longer prefixes.
- The two-element fallback list `['jira_key', 'teams']`. A future migration may rotate these or add more.

### Behavioral rule

Given a parsed Initiatives CSV, the **Column detector** for the Initiative key returns the header whose column values most resemble Jira keys above the **Detection threshold**, falling back to a **Sensible format** header (`jira_key`) and then to the **Quirky format** header (`teams`) when no content match is found.

### Invariants
- `detectInitKeyCol(rows)` is a *total function*: it returns a string for every input, including the empty-rows case.
- The returned header is one of: (a) a key of `rows[0]`, or (b) one of the two documented fallback names `'jira_key'` / `'teams'`. It is never a fabricated string.
- `detectedCols.initKeyCol` equals `detectInitKeyCol(parsedInitiatives)` immediately after `loadInitiativesCSV` returns.
- Calling `detectInitKeyCol` twice on the same rows returns the same header (determinism).

### Counterexamples (must NOT pass)
- A detector that returns `null` or `undefined` when no column matches — downstream code reads `row[initKeyCol]` and would silently produce `undefined`-keyed lookups everywhere.
- A detector that mutates `rows` (e.g. trims values in place) — it must be a pure read.
- A detector that throws when the CSV is empty — empty CSVs are a user-reachable state and must produce the fallback.
- A detector that uses `Object.values(rows[0])` instead of scanning all rows — single-row CSVs would still need to detect, but multi-row CSVs would miss a column whose first row is blank.
- Hard-coding the choice to `'jira_key'` and removing the content scan — the legacy Quirky format would silently break.

### Forbidden shortcuts
- Do not introduce a "CSV format" enum (`quirky` / `sensible`) and branch detectors on it. Format detection is *emergent* from the column detectors — there is no top-level discriminator and there should not be one.
- Do not cache the regex on `window` or as a module constant — keep it local to the detector. (We trade DRY for locality at this scale.)
- Do not call `detectInitKeyCol` from outside `loadInitiativesCSV` to "re-check" the column — call it once at load and trust `detectedCols`.

### RED gate

On an unimplemented build (detector absent or stubbed to return `'jira_key'` unconditionally):
- Manual step 1 (Quirky-format upload) leaves `detectedCols.initKeyCol === 'jira_key'` instead of `'teams'`, and the downstream Initiative count in the data preview reads 0 (because no row has a populated `jira_key`).
- Manual step 4 (empty CSV) may throw if the stub forgets the zero-rows guard.

### Test immutability rule

There are no test files to freeze (manual harness). If a test suite is later introduced and Phase 1's acceptance steps are codified, those tests live under `tests/acceptance/` and are off-limits to the implementation session.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-4 all pass in a fresh browser tab.
- [ ] `detectedCols.initKeyCol` is read by `prepareSimulationData` (and any other consumer) directly — no consumer reads `parsedInitiatives[0]` to re-discover the column.
- [ ] No console errors during the golden path; the single `[Initiatives] …` log line is present.
- [ ] `git diff` touches only `index.html` (ADR-0001).

---

## Phase 2: Remaining detectors, MoSCoW normalisation, and the debug panel

### Acceptance behavior

Scenario AT-1: Quirky format — MoSCoW found in `emoji`, normalised across emoji prefixes
Given the user uploads a Quirky-format Initiatives CSV whose `emoji` column holds values like `🔵 Should`, `🟢 Could`, `🔴 Must`
When `loadInitiativesCSV` parses the file
Then `detectedCols.moscowCol === 'emoji'`
And for every initiative row, `normalizeMoscow(row[detectedCols.moscowCol])` returns one of `'must'`, `'should'`, `'could'`, `'wont'`, `'unknown'`
And rows whose normalised MoSCoW is `'must'`/`'should'`/`'could'` are bucketed into the corresponding **MoSCoW** bucket; `'wont'` and `'unknown'` are excluded from every **Scenario** (joint behavior with feature 0004)

Scenario AT-2: Sensible format — MoSCoW found in `moscow`, no emoji to strip
Given the user uploads a Sensible-format Initiatives CSV whose `moscow` column holds `must`, `should`, `could`
When `loadInitiativesCSV` parses the file
Then `detectedCols.moscowCol === 'moscow'`
And `normalizeMoscow` returns the expected tokens

Scenario AT-3: Name and team columns derived from header name first, then by position
Given the user uploads a Sensible-format CSV with a `building_block` header
When `loadInitiativesCSV` parses the file
Then `detectedCols.nameCol === 'building_block'` (direct header match)
Given instead a Quirky-format CSV with no `building_block` header
When `loadInitiativesCSV` parses the file
Then `detectedCols.nameCol` equals the header immediately before `detectedCols.initKeyCol` in column order (positional fallback)
And `detectedCols.teamCol` equals the header immediately before `detectedCols.moscowCol`, unless that header is the same as `initKeyCol`, in which case it falls back to `'teams'`

Scenario AT-4: Key Result column detected by header variants when present, `null` when absent
Given the Initiatives CSV has a `key_result` header (case-insensitive among `key_result`, `kr`, `key result`, `keyresult`, `key_results`)
Then `detectedCols.krCol` equals the matched header
Given the CSV has none of those headers
Then `detectedCols.krCol === null`

Scenario AT-5: Epic→Initiative link uses header heuristic first, then content scan
Given the user uploads an Epics CSV with a column named `Initiative Jira Key` whose values are Jira keys
When `loadEpicsFile` runs
Then `detectEpicLinkCol` selects `'Initiative Jira Key'` by header heuristic (`initiative` + `jira`/`key`, case-insensitive)
Given instead an Epics CSV with no such header but with a different column whose values are > 40% Jira-key-shaped
Then `detectEpicLinkCol` selects that column by content scan
And in both cases, every parsed Epic row carries a populated `_initiative_key` field (joint behavior with feature 0001)
And `detectedCols.epicLinkCol === '(normalised→_initiative_key)'` after the load, signalling that downstream readers should use the synthetic field, not the raw header

Scenario AT-6: Debug panel reveals detected columns after preview renders
Given both CSVs have been loaded and `renderPreview` has run
Then the `<details id="debug-details">` panel is visible
And its `<pre id="debug-pre">` contains a JSON dump beginning `Detected columns:` with the six keys `initKeyCol`, `moscowCol`, `teamCol`, `nameCol`, `krCol`, `epicLinkCol`
And the panel also contains a `Target MoSCoW breakdown:` JSON section (joint behavior with feature 0009)

### Public entry point

In-code:
- `detectMoscowCol`, `detectNameCol`, `detectTeamCol`, `detectKrCol` — all called from `loadInitiativesCSV` (`index.html:1507-1512`).
- `detectEpicLinkCol` — called from `loadEpicsFile` (`index.html:1557`).
- `normalizeMoscow`, `normalizeSize` — called wherever values from the detected columns are interpreted (e.g. `prepareSimulationData`, the dedup logic in `loadEpicsFile`).

UI: the only user-visible surface specific to this phase is the "Column detection debug" `<details>` panel.

### Expected observable outcomes
- After a successful load of both CSVs, `detectedCols` contains all six expected keys with string values (except `krCol`, which may be `null`).
- The debug panel is visible (`#debug-details` has `display: block`) and its `<pre>` shows the JSON dump.
- `normalizeMoscow` returns one of `'must'`, `'should'`, `'could'`, `'wont'`, `'unknown'` for any string input — never throws, never returns anything else.
- `normalizeSize` returns the input string trimmed and uppercased — preserving any string that is not a **Recognised t-shirt size** (e.g. `'XXL'`) so downstream code can decide what to do with unknowns.
- Within-file Epic dedup uses `T_SHIRT_PARAMS[normalizeSize(row._tshirt_size)]` as the **Recognised t-shirt size** test; the row with a recognised size wins the tie.

### Test harness

Acceptance tests:
- Location: **N/A — manual.**
- Manual steps:
  1. Upload a Quirky-format pair. Observe in the debug panel: `moscowCol: "emoji"`, `nameCol` is the header before `initKeyCol`, `teamCol` is the header before `moscowCol` (or `'teams'` as fallback). `epicLinkCol: "(normalised→_initiative_key)"`.
  2. Upload a Sensible-format pair. Observe: `moscowCol: "moscow"`, `nameCol: "building_block"`, `teamCol: "teams"`, `krCol` matches whichever KR header variant was used (or `null`).
  3. In DevTools console, run `normalizeMoscow('🔵 Should')` → `'should'`. Run `normalizeMoscow('won\\'t')` → `'wont'`. Run `normalizeMoscow('')` → `'unknown'`.
  4. Inspect a parsed epic row in DevTools: `row._initiative_key` is populated; no consumer reads `row[detectedCols.epicLinkCol]` (the sentinel string would not be a valid key).
  5. Open the debug panel after a load and confirm the JSON contains all six keys plus the `Target MoSCoW breakdown` section.

Inner tests:
- Location: **N/A.** Pure detectors and pure normalisers are trivially testable if a harness is added later.

Verification:
- Manual, as above.

Fake-injection wiring:
- N/A.

### Proposed implementation seams

Stable seams:
- `detectMoscowCol(rows)` — pure, mirrors `detectInitKeyCol`'s content-scan-then-fallback shape.
- `detectNameCol(rows, initKeyColHeader)` — depends on the result of `detectInitKeyCol` for its positional fallback.
- `detectTeamCol(rows, initKeyColHeader, moscowColHeader)` — depends on both prior results.
- `detectKrCol(rows)` — header-only (no content scan); may return `null`.
- `detectEpicLinkCol(rows)` — header heuristic, then content scan, then final fallback.
- `normalizeMoscow(raw)` and `normalizeSize(raw)` — pure transforms.

Do NOT lock in:
- The exact KR header variants list (`['key_result', 'kr', 'key result', 'keyresult', 'key_results']`) — additions are allowed.
- The MoSCoW emoji-stripping regex (`/[^\x00-\x7F]/g`) — a Unicode-aware replacement is allowed if the keyword match still succeeds.
- The format of the debug panel's JSON (currently 2-space indented `JSON.stringify`).

### Behavioral rule

For each semantic column an Initiative or Epic CSV must yield, there is exactly one **Column detector** that — via a **Content scan**, header-name heuristic, positional fallback, or a combination — returns one header name to read that column from. Detection is total (never returns "unknown column"), pure (no I/O, no DOM), and surfaced in the column detection debug panel after the preview renders.

Once a column's header is known, the corresponding value is interpreted through the matching normaliser (`normalizeMoscow` for MoSCoW, `normalizeSize` for t-shirt sizes) — never by ad-hoc string comparison at the call site.

### Invariants
- After a successful `loadInitiativesCSV`, `detectedCols` contains keys `initKeyCol`, `moscowCol`, `teamCol`, `nameCol`, `krCol`, each a string (or `null` for `krCol`).
- After a successful `loadEpicsFile`, `detectedCols.epicLinkCol === '(normalised→_initiative_key)'`. No consumer reads `row[detectedCols.epicLinkCol]` directly.
- `normalizeMoscow(s) ∈ {'must', 'should', 'could', 'wont', 'unknown'}` for any string `s`. The empty string, `null`, and `undefined` all map to `'unknown'`.
- `normalizeSize(s)` is idempotent: `normalizeSize(normalizeSize(s)) === normalizeSize(s)`.
- `teamCol !== initKeyCol` after `detectTeamCol` runs — the explicit guard in the positional fallback enforces this.
- The debug panel becomes visible *only after* `renderPreview` runs (which requires a successful Initiatives load *and* a valid historical quarter selection). It is hidden until then.

### Counterexamples (must NOT pass)
- A `detectMoscowCol` that returns the *last* matching column instead of the first — the Quirky format has both `emoji` (MoSCoW) and a real `moscow`-named column appearing in later positions in some exports; we want `emoji` to win because that's where the values live in legacy data.
- A `normalizeMoscow` that strips emoji *after* the keyword match — `🔵 Must` would not match `must` if the emoji is still present at compare time.
- A `detectEpicLinkCol` that runs the content scan *first* and the header heuristic second — would pick a wrong Jira-key-shaped column (e.g. the epic's own key column) when the user had clearly named their link column.
- Storing the raw `epicLinkCol` header in `detectedCols` and asking downstream consumers to read `row[detectedCols.epicLinkCol]` — duplicates the `_initiative_key` mutation and creates two sources of truth.
- A debug panel that shows raw `parsedInitiatives[0]` keys — would hide which header was *selected* and undermine the panel's diagnostic value.
- A `detectKrCol` that mutates `rows` (e.g. to lowercase all headers) instead of comparing through a lowercase view — breaks the case-preserving contract.

### Forbidden shortcuts
- Do not skip the content scan in `detectInitKeyCol` and `detectMoscowCol` when the Sensible-format header is present. The content scan is the canonical path and works for *both* formats; the header-name lookup is only a fallback.
- Do not hard-code MoSCoW emoji codepoints (🔴🟠🟡🟢🔵) — the emoji-strip regex `/[^\x00-\x7F]/g` is the contract, and it tolerates whatever emoji the user's export tool emits.
- Do not couple detector ordering to a global enum — each `loadX` function calls detectors in the order they need; do not abstract that into a "detection pipeline" class.
- Do not branch detectors on file name, MIME type, or any property of the upload control. Detection runs on parsed rows only.
- Do not log full `detectedCols` from inside a detector. The single `console.log` line lives in the loader.

### RED gate

On an unimplemented build (detectors stubbed to return their fallback names, normalisers stubbed to return raw input):
- Manual step 1 (Quirky pair): debug panel reads `moscowCol: "moscow"` (wrong — the column doesn't exist), Initiative count is 0, MoSCoW breakdown is all `unknown`.
- Manual step 3 (`normalizeMoscow('🔵 Should')`): returns `'🔵 Should'` (unchanged) instead of `'should'`.
- Manual step 4 (epic row inspection): `row._initiative_key` is empty because `detectEpicLinkCol` picked the wrong (or no) column.
- Manual step 5 (debug panel): the panel is either hidden or shows only the `Target MoSCoW breakdown` section without `Detected columns`.

### Test immutability rule

Same as Phase 1: N/A in the current project.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-6 all pass.
- [ ] Both **Sensible format** and **Quirky format** CSVs round-trip through `loadInitiativesCSV` + `loadEpicsFile` + a Run with identical results (compare the org-level P50 across the two formats on the same logical data — they must match).
- [ ] The debug panel JSON contains all six expected keys and is the only place in the UI that surfaces detection decisions.
- [ ] `normalizeMoscow` exhibits the closed-set output property (random fuzzing via DevTools console returns only the five documented tokens).
- [ ] No console errors during the golden path.
- [ ] `git diff` touches only `index.html`.
