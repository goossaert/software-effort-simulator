# Feature: CSV upload UI for Initiatives and Epics

Created at: 2026-05-20T20:44:59Z

## Context

This is the foundational feature of the simulator; everything downstream (parsing, preview, simulation, charting) reads from in-memory state populated here.

Relevant cross-cutting decisions:
- [ADR-0001 — Single-file HTML app, no build step](../adr/0001-single-file-html-app.md). Constrains the implementation seam: there is no module system, only globals on `window`.
- [ADR-0002 — Client-side only, no backend](../adr/0002-client-side-only.md). The file never leaves the browser; `FileReader` is the only ingestion mechanism.
- [ADR-0003 — CSV as the input format](../adr/0003-csv-input-format.md). PapaParse is loaded from CDN; the upload affordance must accept any CSV the user can produce, not a tool-specific schema.
- [ADR-0004 — Two-file Initiative/Epic model](../adr/0004-two-file-initiative-epic-model.md). The dual-input gating in this feature exists because both files are required to join the domain model.

Glossary terms used below: **Initiative**, **Epic**, **Initiatives CSV**, **Epics CSV**, **Run** (see [CONTEXT.md](../../CONTEXT.md)).

## User-visible behavior

A user opening the app sees a sidebar with two CSV upload controls — one for the **Initiatives CSV** and one for the **Epics CSV**. Clicking either control opens the OS file picker; selecting a `.csv` file loads it into the app, swaps the control's icon from 📄 to ✅, displays the file name, and reveals a per-file `✕ Remove file` button. The `▶ Run Simulation` button at the bottom of the sidebar starts disabled and becomes enabled the moment both files are loaded. Removing either file disables the Run button again and resets the corresponding control's affordance back to its empty state.

If a file cannot be parsed as CSV, the user sees a browser `alert()` with the error message; the control stays in its previous state (no half-loaded ✅).

## Scope

### In scope
- Two sidebar file-input controls: `#initiatives-file` and `#epics-file`.
- Per-control visual states: empty (📄, "Click to upload…"), loaded (✅, file name visible, remove button revealed).
- Per-control reset: a `✕ Remove file` button that clears the input, drops the parsed rows from memory, restores the empty state, and re-disables Run.
- Run button (`#run-btn`) gated on *both* files being loaded.
- Error path: parse failures surface via `alert()` and leave the prior state untouched.
- The data model populated by load: `parsedInitiatives` (array of row objects) and `parsedEpics` (array of row objects with synthetic `_initiative_key`, `_tshirt_size`, `_quarter`, `_epic_key` fields).

### Out of scope
- The Constant Work CSV upload (feature 0015).
- Column auto-detection logic for the parsed contents (feature 0002 — this feature only loads the rows; downstream features interpret them).
- Quarter multi-select population (feature 0010 — this feature only stores the rows).
- The data preview panel (feature 0009).
- The Run button's behavior *after* being clicked — only its enabled/disabled state is in scope.
- Drag-and-drop upload; folder upload; multi-file upload (multi-file epic upload was tried and removed — see `backtracked-features.md`).

## Relevant existing files
Claude may inspect:
- `index.html` — the entire single-file app. Especially:
  - The sidebar markup around `#init-upload` and `#epics-upload` (currently `index.html:837-859`).
  - `loadInitiativesCSV` (`index.html:1503`), `loadEpicsFile` (`index.html:1554`), `readFile` (`index.html:2859`).
  - `resetInitiativesFile` / `resetEpicsFile` (`index.html:1603-1629`).
  - `checkRunButton` (`index.html:2868`) and the file-input event handlers (`index.html:2887-2917`).
- `CONTEXT.md` for glossary.
- ADRs 0001–0004 for the constraints those handlers must respect.

Claude should not inspect unless needed:
- Anything in `index.html` past line ~2945 (later modules: marker system, projections, initiatives tab).
- `backtracked-features.md` — that file is the meta-index of features and is not normative.

## Existing patterns to follow
- **Layering inside `index.html`**: the file is organised into commented "MODULE" blocks (Module 1 = CSV parsing, Module 4 = data prep, Module 7 = UI controller). The upload handlers live in Module 7; the load functions they delegate to live in Module 3 (initiatives) and the epics-loading module. Keep that separation: DOM event listeners do not parse CSV directly — they call `loadInitiativesCSV(text)` or `loadEpicsFile(file)`.
- **State**: parsed rows are kept as module-scoped `let`-bindings (`parsedInitiatives`, `parsedEpics`). The two booleans `initiativesLoaded` and `epicsLoaded` exist *only* to gate the Run button; load-state truthiness should not be derived from the row arrays elsewhere.
- **CSV parsing**: always go through `parseCSV(text)` which wraps `Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: false })`. Do not call `Papa.parse` directly.
- **Reading files**: always go through the `readFile(file)` Promise helper. Do not instantiate `FileReader` inline in handlers.
- **Visual state toggling**: the loaded/empty state is driven by adding/removing the `loaded` class on the wrapper (`#init-upload`, `#epics-upload`) and swapping the inner `.file-icon` text content. No CSS variables, no inline styles for state.
- **No framework**: vanilla DOM (`document.getElementById`, `addEventListener`). No React, no jQuery, no Web Components.
- **Verification command**: there is no automated test harness in this project. Verification is manual: open `index.html` in a browser (`open index.html` on macOS) and exercise the flow described in the acceptance scenarios.

> **Ubiquitous-language rule — applies to all sections from here down:**
> Every entity, field, and behavior name used in Data models, acceptance
> scenarios (Given/When/Then), Behavioral rules, and Invariants must match
> `CONTEXT.md` glossary terms verbatim. Do not introduce synonyms,
> abbreviations, or implementation-layer names that differ from the glossary.

## Data models

No persistence layer — this is a client-side-only app (ADR-0002). In-memory state populated by this feature:

```js
// Module-scoped, declared once near the top of the loaders module.
let parsedInitiatives = null;   // Array<RowObject> | null
let parsedEpics       = null;   // Array<EpicRow>   | null
let initiativesLoaded = false;  // gate flag for Run button
let epicsLoaded       = false;  // gate flag for Run button
```

Shape of `RowObject` (Initiatives): an opaque object keyed by whatever headers the CSV had — this feature does not interpret columns. PapaParse returns one such object per non-empty data row.

Shape of `EpicRow` (Epics): same as `RowObject` plus four synthetic fields added during load:
- `_initiative_key: string` — the parent Initiative key, drawn from the link column.
- `_tshirt_size: string` — the t-shirt size, drawn from any of the size column variants.
- `_quarter: string` — the quarter, drawn from any of the quarter column variants.
- `_epic_key: string` — the epic's own Jira key, used for in-file dedup.

Within-file dedup invariant: if two epic rows share the same non-empty `_epic_key`, only one survives the load — preferring the row whose `_tshirt_size` is a recognised t-shirt size when there is a choice. Rows with empty `_epic_key` are kept verbatim.

---

## Phase 1: Initiatives CSV uploads, the Run button stays disabled

### Acceptance behavior

Scenario AT-1: Initiatives file loads successfully
Given the app has just opened with no files loaded
And the Run button is disabled
When the user picks a valid Initiatives CSV in the `#initiatives-file` input
Then the `#init-upload` wrapper gains the `loaded` class
And its `.file-icon` shows ✅
And `#init-file-name` shows the chosen file's name
And the `#init-reset-row` becomes visible
And the Run button stays disabled (because the Epics CSV is still missing)

Scenario AT-2: Initiatives parse error leaves prior state intact
Given the app has just opened with no files loaded
When the user picks a file whose contents are not parseable CSV (e.g. binary content that `Papa.parse` rejects with errors and zero rows — note: `Papa.parse` is permissive, so this scenario is exercised by forcing `loadInitiativesCSV` to throw)
Then a browser `alert()` appears with a message starting `Error loading initiatives CSV:`
And the `#init-upload` wrapper does NOT gain the `loaded` class
And the Run button stays disabled

Scenario AT-3: Initiatives reset returns to empty state
Given the user has just successfully loaded an Initiatives CSV
When the user clicks `#init-reset-btn`
Then the `#initiatives-file` input's value is cleared
And `#init-file-name` reads `Click to upload…`
And the `#init-upload` wrapper loses the `loaded` class and shows 📄
And `#init-reset-row` is hidden
And the Run button stays disabled

### Public entry point

UI: user picks a file in the sidebar's Initiatives CSV control (`<input type="file" id="initiatives-file" accept=".csv">`). The `change` event on that input is the entry point. A second entry point is the click on `#init-reset-btn`.

### Expected observable outcomes
- DOM: `loaded` class on `#init-upload`, icon swap to ✅, file name visible, reset row visible.
- In-memory state: `parsedInitiatives` populated with an array of row objects; `initiativesLoaded` flips to `true`. Reset reverses both.
- Run button: `#run-btn` `disabled` attribute stays `true` after a successful Initiatives-only load.
- Error path: `alert()` fired with `Error loading initiatives CSV:\n` + the underlying message. State on the wrapper untouched. `parsedInitiatives` and `initiativesLoaded` not mutated.
- No network requests beyond the initial CDN fetches (ADR-0002).

### Test harness

Acceptance tests:
- Location: **N/A — this project has no automated test suite.** Manual acceptance is performed in a browser. The verification steps below replace the test runner.
- Manual steps:
  1. Open `index.html` in a browser.
  2. Confirm the Initiatives upload control is in the empty state (📄, "Click to upload…", no reset row) and that `#run-btn` is disabled.
  3. Pick a known-good Initiatives CSV (e.g. one exported via JQL with the columns documented in CONTEXT.md). Confirm AT-1's `Then` clauses.
  4. Reload the page. Pick a file the parser will reject. Confirm AT-2's `Then` clauses by observing the alert and the unchanged wrapper.
  5. Repeat step 3, then click `✕ Remove file`. Confirm AT-3's `Then` clauses.

Inner tests:
- Location: **N/A — no test harness.** The "inner" behaviors (PapaParse invocation, the `loaded`-class toggle, the reset-row reveal) are exercised by the manual scenarios above. If a harness is added later, the natural seams are listed under *Proposed implementation seams*.

Verification:
- Manual: `open index.html` on macOS (or equivalent) and run through the acceptance steps.
- There is no `make verify` / `npm run verify` command. If one is introduced, this section should be updated to point to it.

Fake-injection wiring:
- N/A — no adapters, no env vars, no fakes. The only external dependency at runtime is the browser's `FileReader`, which is exercised directly against real files.

### Proposed implementation seams

Stable seams a future test suite may target:
- `loadInitiativesCSV(text: string): void` — pure-ish: takes CSV text, populates `parsedInitiatives`, throws on parse failure. No DOM, no FileReader.
- `resetInitiativesFile(): void` — resets state + DOM in one place; callable from a test that has hand-loaded `parsedInitiatives`.
- `checkRunButton(): void` — reads `initiativesLoaded && epicsLoaded`, toggles `#run-btn.disabled`. Pure DOM, no business rules.

Do NOT lock in:
- Internal naming of PapaParse callback parameters.
- The exact text of the `alert()` message (other than the `Error loading initiatives CSV:` prefix).
- The DOM strategy for revealing the reset row (currently `style.display = 'flex'`).

### Behavioral rule

Loading an Initiatives CSV captures its rows into application state and updates the corresponding sidebar control to show "loaded" — but does *not* enable the Run button until the Epics CSV has also been loaded.

### Invariants
- `initiativesLoaded === true` iff `parsedInitiatives !== null` immediately after any load or reset.
- `#run-btn.disabled` is `true` whenever either `initiativesLoaded` or `epicsLoaded` is `false`.
- The `loaded` class on `#init-upload` is present iff `initiativesLoaded === true`.
- Reset is fully reversible: after `resetInitiativesFile()`, the DOM and state are indistinguishable from the just-opened-page state for the Initiatives control.

### Counterexamples (must NOT pass)
- A handler that flips `initiativesLoaded = true` before `parseCSV` returns — Run could be enabled with no rows in memory.
- A reset that clears the file input but leaves `parsedInitiatives` populated, or vice versa.
- A handler that enables `#run-btn` directly instead of going through `checkRunButton()` (would diverge from Phase 2's gating).
- A success path that catches the parse error, logs it, and proceeds with the wrapper in the loaded state.

### Forbidden shortcuts
- Do not inline `FileReader` instantiation in the event listener — go through `readFile(file)`.
- Do not call `Papa.parse` directly from the event listener — go through `loadInitiativesCSV(text)` (which calls `parseCSV(text)`).
- Do not enable `#run-btn` from the Initiatives handler. Gating belongs to `checkRunButton()` only.
- Do not branch on the file name, extension, or MIME type to "fast-path" parsing. The `accept=".csv"` attribute is advisory; trust PapaParse to parse.

### RED gate

Before the implementation session starts, the manual verification must produce these observations on the un-implemented build:
- Manual step 3 (load a valid Initiatives CSV): the icon stays 📄 and `#init-file-name` keeps reading `Click to upload…` — because there is no `change` handler yet, or the handler is a stub.
- Manual step 5 (click `✕ Remove file` after a load): the button does not exist (no `#init-reset-row` markup) or clicking it does nothing.

### Test immutability rule

There are no test files to freeze in this project (manual harness). If a test suite is later introduced and Phase 1's acceptance steps are codified, those tests live under `tests/acceptance/` and are off-limits to the implementation session — only the test-writing session may edit them.

### Definition of done
- [ ] Manual scenarios AT-1, AT-2, AT-3 all pass in a fresh browser tab.
- [ ] `parsedInitiatives`, `initiativesLoaded`, the `loaded` class, and the reset-row visibility move together: there is no observable state where they disagree.
- [ ] No console errors during the golden path.
- [ ] `git diff` touches only `index.html` (single-file constraint, ADR-0001).

---

## Phase 2: Epics CSV uploads, the Run button enables when both are present

### Acceptance behavior

Scenario AT-1: Epics file loads after Initiatives — Run enables
Given the user has already successfully loaded an Initiatives CSV (Phase 1)
And `#run-btn` is disabled
When the user picks a valid Epics CSV in the `#epics-file` input
Then the `#epics-upload` wrapper gains the `loaded` class
And its `.file-icon` shows ✅
And `#epics-file-name` shows the chosen file's name
And `#epics-reset-row` becomes visible
And `#run-btn` becomes enabled

Scenario AT-2: Epics file loads before Initiatives — Run stays disabled
Given the app has just opened with no files loaded
When the user picks a valid Epics CSV in the `#epics-file` input
Then the `#epics-upload` wrapper gains the `loaded` class
And `#run-btn` stays disabled (because the Initiatives CSV is still missing)
And subsequently loading an Initiatives CSV (Phase 1's path) enables `#run-btn`

Scenario AT-3: Epics parse error leaves prior state intact
Given the app has just opened with no files loaded
When the user picks a file that `loadEpicsFile` rejects (e.g. an empty file, which produces zero rows and no detectable link column)
Then a browser `alert()` appears with a message starting `Error loading epics CSV:`
And the `#epics-upload` wrapper does NOT gain the `loaded` class
And `#run-btn` stays disabled

Scenario AT-4: Epics reset disables Run again
Given the user has loaded both CSVs and `#run-btn` is enabled
When the user clicks `#epics-reset-btn`
Then the `#epics-upload` wrapper returns to its empty state (📄, placeholder text, hidden reset row)
And `#run-btn` becomes disabled again
And the Initiatives control's loaded state is untouched

### Public entry point

UI: user picks a file in the sidebar's Epics CSV control (`<input type="file" id="epics-file" accept=".csv">`). The `change` event is the entry point. A second entry point is the click on `#epics-reset-btn`.

### Expected observable outcomes
- DOM: same wrapper-state machinery as Phase 1, on `#epics-upload`.
- In-memory state: `parsedEpics` populated with an array of `EpicRow` objects (each carrying the four synthetic `_initiative_key`, `_tshirt_size`, `_quarter`, `_epic_key` fields). `epicsLoaded` flips to `true`. Reset reverses both.
- Within-file dedup happens as part of load: epics sharing an `_epic_key` collapse to one row, preferring the row with a recognised t-shirt size.
- Run button: `#run-btn.disabled` is `true` if and only if `!(initiativesLoaded && epicsLoaded)` after this load.
- Error path: `alert()` fired with `Error loading epics CSV:\n` + the underlying message. State on the wrapper untouched.

### Test harness

Acceptance tests:
- Location: **N/A — manual.** Same rationale as Phase 1.
- Manual steps:
  1. Load a valid Initiatives CSV first, confirm `#run-btn` is disabled.
  2. Load a valid Epics CSV. Confirm AT-1's `Then` clauses, especially that `#run-btn` is now enabled.
  3. Reload the page. Pick the Epics CSV *first*. Confirm AT-2 (Run stays disabled). Then load the Initiatives CSV and confirm Run enables.
  4. Reload the page. Try to load an Epics file that triggers an error (e.g. an empty file). Confirm AT-3.
  5. From the AT-1 end-state, click `✕ Remove file` on the Epics row. Confirm AT-4.

Inner tests:
- Location: **N/A.** As Phase 1.

Verification:
- Manual: `open index.html` and walk the steps above.

Fake-injection wiring:
- N/A.

### Proposed implementation seams

Stable seams:
- `loadEpicsFile(file: File): Promise<void>` — the async loader that reads, parses, dedups, and populates `parsedEpics` / `epicsLoaded`. Distinct from `loadInitiativesCSV` because dedup needs the raw rows before `parsedEpics` is exposed.
- `resetEpicsFile(): void` — symmetric counterpart of `resetInitiativesFile`.
- `checkRunButton(): void` — shared with Phase 1; this phase only adds the second precondition.

Do NOT lock in:
- The exact set of header variants probed for the link column, t-shirt size, or quarter — that detection logic belongs to feature 0002.
- The internal dedup data structure (currently a `Map`).

### Behavioral rule

Loading an Epics CSV captures its rows (with synthetic link/size/quarter fields and within-file dedup) into application state and updates the sidebar control to "loaded". The Run button becomes enabled if and only if both the Initiatives CSV and the Epics CSV are currently loaded.

### Invariants
- `epicsLoaded === true` iff `parsedEpics !== null` immediately after any load or reset.
- `#run-btn.disabled === !(initiativesLoaded && epicsLoaded)` at all times.
- Within `parsedEpics`, no two rows share the same non-empty `_epic_key`.
- Reset is fully reversible (as in Phase 1) and does not touch the Initiatives control's state.

### Counterexamples (must NOT pass)
- Enabling `#run-btn` from the Epics handler without checking `initiativesLoaded`.
- A dedup that picks the *first* row seen per `_epic_key` instead of preferring rows with a recognised t-shirt size — invariant 3 holds either way, but the recognised-size preference is what makes downstream sampling work.
- A reset that disables `#run-btn` directly (`document.getElementById('run-btn').disabled = true`) instead of going through `checkRunButton()` — would diverge from Phase 1's gating and silently break the "both loaded" path.
- Reading from `parsedEpics` *during* `loadEpicsFile` (other than at the very end) — the public visibility of the new rows should atomically swap, not be observable mid-load.

### Forbidden shortcuts
- Do not derive `epicsLoaded` from `parsedEpics !== null` at every call site — keep them in lock-step inside the loader/reset functions only.
- Do not call `Papa.parse` directly or instantiate `FileReader` directly in the handler. Go through `readFile` and `parseCSV`.
- Do not branch the Run button's `disabled` state on anything other than the two `*Loaded` flags.

### RED gate

On the un-implemented build, manual step 2 (loading a valid Epics CSV after a successful Initiatives load) leaves `#run-btn` disabled — because either the Epics `change` handler is a stub, or `checkRunButton()` is not wired to `epicsLoaded`, or `epicsLoaded` is never flipped.

### Test immutability rule

Same as Phase 1: N/A in the current project. If tests are added later, they're off-limits to the implementation session.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-4 all pass.
- [ ] The Run button enables in both orderings (Initiatives-then-Epics and Epics-then-Initiatives).
- [ ] Within-file dedup observed: loading an Epics CSV with two rows sharing an epic key results in `parsedEpics.length === 1` for that key (verify via DevTools console).
- [ ] No console errors during the golden path.
- [ ] `git diff` touches only `index.html`.
