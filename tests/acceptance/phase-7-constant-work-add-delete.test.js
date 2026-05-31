// Acceptance tests for feature 0021, Phase 7:
//   Add row / delete row / from-scratch authoring on the Constant work tab —
//   the ADR-0034 delta over the read-only-shaped Initiatives tab.
//
// Each `describe('AT-N: …')` block maps to one scenario in
// docs/plans/0021-constant-work-tab-and-group-scoping.md, Phase 7
// "Acceptance behavior".
//
// Behavioral rule under test (ADR-0034):
//   The Constant work tab gains a `+ Add row` control and a per-row delete
//   control. `+ Add row` appends a blank row to `editedConstantWork`: when there
//   is no imported header set to mirror (`parsedConstantWork === null`), the row
//   carries the canonical schema
//   (`jira_key, epic_name, key_result, category, team, quarter, tshirt_size`);
//   otherwise it carries the imported file's header set, so all rows share
//   columns. When `editedConstantWork` is `null`, the first add initialises it to
//   `[]` then appends — enabling from-scratch authoring with no CSV loaded
//   (`parsedConstantWork` stays `null`). Per-row delete splices the row
//   immediately with no confirmation. Validation is lenient: a blank
//   `tshirt_size` is `0` PM, a blank `quarter` is excluded from every simulation,
//   a blank `category` is the **(Blank) sentinel**. The table re-renders after
//   add and delete.
//
// Seams targeted (autonomously chosen — see the atdd handover):
//   • The user-facing `+ Add row` control: a clickable element inside the
//     Constant work tab whose text matches /add row/i. Clicking it appends a row
//     to `editedConstantWork` (initialising `[]` from null) and re-renders.
//   • The per-row delete control: the (single) <button> inside a rendered data
//     row. Clicking it splices that row from `editedConstantWork` and re-renders.
//   • `exportConstantWorkCSV()` (the Phase-6 export seam) for AT-7.
//   • The engine seam `getConstantWorkEffortPerGroup(quarters, groups, teamName?)`
//     (the Phase-2 vector) for AT-4/AT-5, asserting authored rows feed the
//     simulation and lenient blanks behave as documented.
// These deliberately do NOT lock in: the exact control markup (`+ Add row`
// button placement; delete rendered as `×` / `Delete` / `Remove`); whether the
// canonical-schema key set is a shared constant or inline (the KEY SET is the
// contract); the function NAMES of the add / delete handlers (reached through the
// rendered controls, per the plan's "Do NOT lock in" list).

import { describe, it, expect } from 'vitest';
import { loadSimulator, read, evalIn, execIn, csv } from '../harness.js';

const SEVEN_SIZES = ['2XS', 'XS', 'S', 'M', 'L', 'XL', 'XL+'];

// The canonical constant-work schema for a from-scratch row (no import to mirror).
const CANONICAL_SCHEMA = [
  'jira_key', 'epic_name', 'key_result', 'category', 'team', 'quarter', 'tshirt_size',
];

// ─── Fixture helpers ────────────────────────────────────────────────
const INIT_HEADERS = ['jira_key', 'building_block', 'category', 'teams', 'quarter'];

function initiativeRow(jiraKey, teams, quarter, category) {
  return { jira_key: jiraKey, building_block: `Init ${jiraKey}`, category, teams, quarter };
}

function loadInitiatives(win, rows, headers = INIT_HEADERS) {
  execIn(win, `loadInitiativesCSV(${JSON.stringify(csv(rows, headers))})`);
}

// Mount constant-work rows directly on the simulation source of truth
// (`editedConstantWork`, the Phase 1 substrate) — for scenarios that start from
// an existing model (e.g. AT-3 delete) rather than from-scratch authoring.
function setConstantWork(win, rows) {
  execIn(win, `editedConstantWork = ${JSON.stringify(rows)};`);
}

// Install a Group snapshot in `groupsStore` (using the BLANK sentinel binding
// for blank-Category membership where requested).
function setGroups(win, exprArrayJs) {
  execIn(win, `groupsStore.length = 0; for (const g of (${exprArrayJs})) groupsStore.push(g);`);
}

function renderTable(win) {
  execIn(win, 'renderConstantWorkTable();');
}

function bodyRows(win) {
  return win.document.querySelectorAll('#constant-work-table-wrap tbody tr');
}

// Map a column name (the table header text === the row-object key) to its index.
function headerIndex(win, colName) {
  const ths = [...win.document.querySelectorAll('#constant-work-table-wrap thead th')];
  return ths.findIndex(th => th.textContent.trim() === colName);
}

// The element matching `selector` in the (rowIdx, colName) cell of the rendered
// table, located by header text so the test is robust to column ordering.
function cellEl(win, rowIdx, colName, selector) {
  const idx = headerIndex(win, colName);
  if (idx < 0) return null;
  const row = bodyRows(win)[rowIdx];
  if (!row) return null;
  const td = row.querySelectorAll('td')[idx];
  return td ? td.querySelector(selector) : null;
}

// Resolve the datalist option values referenced by an `<input list="…">` cell.
function datalistOptions(win, inputEl) {
  if (!inputEl) return null;
  const id = inputEl.getAttribute('list');
  if (!id) return null;
  const dl = win.document.getElementById(id);
  if (!dl) return [];
  return [...dl.querySelectorAll('option')].map(o => o.value);
}

function pm(win, size) {
  return evalIn(win, `tshirtToPersonMonths(${JSON.stringify(size)})`);
}

// The user-facing `+ Add row` control: any clickable element inside the Constant
// work tab whose visible text matches /add row/i. Not locked to a function name
// or markup placement (per the plan's "Do NOT lock in" list).
function addRowControl(win) {
  const scope = win.document.getElementById('tab-constant-work') || win.document;
  const els = [...scope.querySelectorAll('button, a, [role="button"]')];
  return els.find(e => /add\s*row/i.test(e.textContent || '')) || null;
}

// Assert a `+ Add row` control exists, then click it. Keeps the RED-gate
// failure reason crisp ("a + Add row control should exist …") instead of a bare
// TypeError when the control is absent.
function clickAddRow(win) {
  const btn = addRowControl(win);
  expect(btn, 'a + Add row control should exist on the Constant work tab').toBeTruthy();
  btn.click();
}

// The per-row delete control: the (single) <button> inside a rendered data row.
// Editor cells are <input>/<select>, never <button>, so the row's button is the
// delete affordance. Prefer one whose text reads as delete/remove (×/Delete/…),
// else fall back to the first button — robust to either rendering.
function rowDeleteControl(win, rowIdx) {
  const row = bodyRows(win)[rowIdx];
  if (!row) return null;
  const btns = [...row.querySelectorAll('button')];
  if (!btns.length) return null;
  const named = btns.find(b => /delete|remove|×|✕|✖|^\s*x\s*$/i.test(b.textContent || ''));
  return named || btns[0];
}

// Set a rendered cell editor's value and fire its inline `onchange` write-through.
function fillCell(win, rowIdx, colName, value, selector) {
  const el = cellEl(win, rowIdx, colName, selector);
  if (!el) return false;
  el.value = value;
  el.dispatchEvent(new win.Event('change', { bubbles: true }));
  return true;
}

// Capture the text Papa.unparse wrote into the Blob AND the download filename the
// export anchor targeted — mirrors the Phase-6 export test.
function captureExport(win, exprThatExports) {
  return execIn(win, `
    let _name = null, _captured = null;
    const _origBlob = window.Blob;
    function _CaptureBlob(parts, opts) {
      _captured = (parts || []).map(function (p) { return String(p); }).join('');
      return new _origBlob(parts, opts);
    }
    window.Blob = _CaptureBlob;
    const _origCreate = document.createElement.bind(document);
    document.createElement = function (tag) {
      const el = _origCreate(tag);
      if (String(tag).toLowerCase() === 'a') {
        Object.defineProperty(el, 'download', {
          set: function (v) { _name = v; },
          get: function () { return _name; },
          configurable: true,
        });
      }
      return el;
    };
    const _origUrl = URL.createObjectURL;
    const _origRev = URL.revokeObjectURL;
    URL.createObjectURL = function () { return 'blob:test'; };
    URL.revokeObjectURL = function () {};
    try { ${exprThatExports} } finally {
      window.Blob = _origBlob;
      document.createElement = _origCreate;
      URL.createObjectURL = _origUrl;
      URL.revokeObjectURL = _origRev;
    }
    return { name: _name, text: _captured };
  `);
}

// ─── AT-1: + Add row appends a blank canonical-schema row when nothing imported ─
describe('AT-1: + Add row appends a blank canonical-schema row when nothing was imported', () => {
  it('appends exactly one canonical-schema row (all cells blank) to editedConstantWork and re-renders', () => {
    const win = loadSimulator();
    // Given nothing was imported.
    expect(read(win, 'editedConstantWork')).toBeNull();
    expect(read(win, 'parsedConstantWork')).toBeNull();
    renderTable(win);

    const addBtn = addRowControl(win);
    expect(addBtn, 'a + Add row control should exist even with nothing imported').toBeTruthy();
    addBtn.click();

    const ecw = read(win, 'editedConstantWork');
    expect(Array.isArray(ecw)).toBe(true);
    expect(ecw).toHaveLength(1);
    // Keys are exactly the canonical schema, in order …
    expect(Object.keys(ecw[0])).toEqual(CANONICAL_SCHEMA);
    // … and every cell is blank (property over all canonical keys).
    for (const k of CANONICAL_SCHEMA) expect(ecw[0][k]).toBe('');
    // From-scratch: parsedConstantWork stays null (only editedConstantWork populated).
    expect(read(win, 'parsedConstantWork')).toBeNull();
    // The table re-rendered with that row.
    expect(bodyRows(win)).toHaveLength(1);
  });

  it('initialises an empty-array model to one canonical row on the first add (boundary)', () => {
    const win = loadSimulator();
    // editedConstantWork already initialised to [] (e.g. a prior from-scratch session
    // that was emptied), parsedConstantWork still null.
    execIn(win, 'editedConstantWork = [];');
    renderTable(win);

    const addBtn = addRowControl(win);
    expect(addBtn, 'a + Add row control should exist for an empty model').toBeTruthy();
    addBtn.click();

    const ecw = read(win, 'editedConstantWork');
    expect(ecw).toHaveLength(1);
    expect(Object.keys(ecw[0])).toEqual(CANONICAL_SCHEMA);
  });
});

// ─── AT-2: + Add row uses the imported header set when a CSV was imported ───────
describe('AT-2: + Add row appends a blank row carrying the imported header set, not the canonical schema', () => {
  it('gives the new row exactly the imported headers (blank) so all rows share columns', () => {
    const win = loadSimulator();
    const headers = ['epic_key', 'building_block', 't_shirt_size', 'category', 'team', 'quarter', 'notes'];
    const text = csv([
      { epic_key: 'CW-1', building_block: 'Block A', t_shirt_size: 'M', category: 'Backend', team: 'Platform', quarter: 'Q3 2026', notes: 'n1' },
    ], headers);
    execIn(win, `loadConstantWorkCSV(${JSON.stringify(text)})`);
    renderTable(win);

    const addBtn = addRowControl(win);
    expect(addBtn).toBeTruthy();
    addBtn.click();

    const ecw = read(win, 'editedConstantWork');
    expect(ecw).toHaveLength(2);
    const newRow = ecw[ecw.length - 1];
    // The appended row mirrors the imported header set exactly (blank values) …
    expect(Object.keys(newRow)).toEqual(headers);
    for (const k of headers) expect(newRow[k]).toBe('');
    // … so every row shares the same columns.
    expect(Object.keys(newRow)).toEqual(Object.keys(ecw[0]));
    // Negative: the canonical schema was NOT used (no jira_key / tshirt_size keys).
    expect(Object.keys(newRow)).not.toContain('jira_key');
    expect(Object.keys(newRow)).not.toContain('tshirt_size');
  });
});

// ─── AT-3: per-row delete removes the row immediately with no confirmation ──────
describe('AT-3: per-row delete removes the targeted row immediately with no confirmation', () => {
  it('splices exactly the targeted row, preserves the order of the rest, and never prompts for confirmation', () => {
    const win = loadSimulator();
    setConstantWork(win, [
      { jira_key: 'CW-1', epic_name: 'A', category: 'Backend', team: 'Platform', quarter: 'Q3 2026', tshirt_size: 'M' },
      { jira_key: 'CW-2', epic_name: 'B', category: 'Frontend', team: 'Web', quarter: 'Q3 2026', tshirt_size: 'L' },
      { jira_key: 'CW-3', epic_name: 'C', category: 'Ops', team: 'Platform', quarter: 'Q4 2026', tshirt_size: 'S' },
    ]);
    renderTable(win);

    // Guard against any confirmation dialog being raised by delete.
    execIn(win, 'window.__confirmCalls = 0; window.confirm = function () { window.__confirmCalls++; return true; };');

    const delBtn = rowDeleteControl(win, 1); // delete the MIDDLE row
    expect(delBtn, 'each data row should have a delete control').toBeTruthy();
    delBtn.click();

    const ecw = read(win, 'editedConstantWork');
    expect(ecw).toHaveLength(2);
    // The remaining rows keep their original order (CW-1 then CW-3).
    expect(ecw.map(r => r.jira_key)).toEqual(['CW-1', 'CW-3']);
    // No confirmation dialog appeared.
    expect(evalIn(win, 'window.__confirmCalls')).toBe(0);
    // The table re-rendered with the two survivors.
    expect(bodyRows(win)).toHaveLength(2);
  });

  it('removing the only row leaves an empty model and an empty table (boundary)', () => {
    const win = loadSimulator();
    setConstantWork(win, [
      { jira_key: 'CW-1', epic_name: 'A', category: 'Backend', team: 'Platform', quarter: 'Q3 2026', tshirt_size: 'M' },
    ]);
    renderTable(win);

    const delBtn = rowDeleteControl(win, 0);
    expect(delBtn).toBeTruthy();
    delBtn.click();

    expect(read(win, 'editedConstantWork')).toHaveLength(0);
    expect(bodyRows(win)).toHaveLength(0);
  });
});

// ─── AT-4: from-scratch authoring with no CSV loaded feeds the simulation ───────
describe('AT-4: an authored-from-scratch row feeds its Group fixedEffortPerGroup shift', () => {
  it('lifts only the Group whose members include the authored Category, with parsedConstantWork staying null', () => {
    const win = loadSimulator();
    setGroups(win, `[
      { name: 'Backend',  color: '#a', members: ['Backend'],  isProjection: true },
      { name: 'Frontend', color: '#b', members: ['Frontend'], isProjection: false },
    ]`);
    // No constant work loaded at all.
    expect(read(win, 'editedConstantWork')).toBeNull();
    renderTable(win);

    // User clicks + Add row, then fills the cells (category + quarter + size).
    clickAddRow(win);
    expect(fillCell(win, 0, 'category', 'Backend', 'input[list]')).toBe(true);
    expect(fillCell(win, 0, 'quarter', 'Q3 2026', 'input[list]')).toBe(true);
    expect(fillCell(win, 0, 'tshirt_size', 'M', 'select')).toBe(true);

    const vector = evalIn(win, `getConstantWorkEffortPerGroup(${JSON.stringify(['Q3 2026'])}, groupsStore)`);
    // Backend (matching) lifted by the authored size's PM …
    expect(vector[0]).toBeCloseTo(pm(win, 'M'), 10);
    // … Frontend (non-matching) untouched (negative).
    expect(vector[1]).toBe(0);
    // From-scratch authoring never populates parsedConstantWork.
    expect(read(win, 'parsedConstantWork')).toBeNull();
  });
});

// ─── AT-5: lenient blanks on an authored row ────────────────────────────────────
describe('AT-5: lenient blanks on an authored row (blank size → 0 PM, blank quarter → excluded, blank Category → BLANK)', () => {
  it('contributes 0 PM for a blank tshirt_size even when Category and Target quarter match a Group', () => {
    const win = loadSimulator();
    setGroups(win, `[{ name: 'Backend', color: '#a', members: ['Backend'], isProjection: true }]`);
    renderTable(win);

    clickAddRow(win);
    expect(fillCell(win, 0, 'category', 'Backend', 'input[list]')).toBe(true);
    expect(fillCell(win, 0, 'quarter', 'Q3 2026', 'input[list]')).toBe(true);
    // tshirt_size left blank (canonical add leaves it '').
    expect(read(win, 'editedConstantWork')[0].tshirt_size).toBe('');

    const vector = evalIn(win, `getConstantWorkEffortPerGroup(${JSON.stringify(['Q3 2026'])}, groupsStore)`);
    expect(vector[0]).toBe(0);
  });

  it('excludes a blank-quarter row from every Target-quarter sum', () => {
    const win = loadSimulator();
    setGroups(win, `[{ name: 'Backend', color: '#a', members: ['Backend'], isProjection: true }]`);
    renderTable(win);

    clickAddRow(win);
    expect(fillCell(win, 0, 'category', 'Backend', 'input[list]')).toBe(true);
    expect(fillCell(win, 0, 'tshirt_size', 'M', 'select')).toBe(true);
    // quarter left blank.
    expect(read(win, 'editedConstantWork')[0].quarter).toBe('');

    const vector = evalIn(win, `getConstantWorkEffortPerGroup(${JSON.stringify(['Q3 2026'])}, groupsStore)`);
    expect(vector[0]).toBe(0); // excluded — blank quarter is in no Target quarter
  });

  it('treats a blank Category as the (Blank) sentinel, matching only Groups whose members include BLANK', () => {
    const win = loadSimulator();
    // Group A targets the (Blank) sentinel; Group B targets Backend.
    setGroups(win, `[
      { name: 'A', color: '#a', members: [BLANK],     isProjection: true },
      { name: 'B', color: '#b', members: ['Backend'], isProjection: false },
    ]`);
    renderTable(win);

    clickAddRow(win);
    expect(fillCell(win, 0, 'quarter', 'Q3 2026', 'input[list]')).toBe(true);
    expect(fillCell(win, 0, 'tshirt_size', 'M', 'select')).toBe(true);
    // category left blank → (Blank) sentinel.
    expect(read(win, 'editedConstantWork')[0].category).toBe('');

    const vector = evalIn(win, `getConstantWorkEffortPerGroup(${JSON.stringify(['Q3 2026'])}, groupsStore)`);
    expect(vector[0]).toBeCloseTo(pm(win, 'M'), 10); // A: members include BLANK → matched
    expect(vector[1]).toBe(0);                        // B: members ['Backend'] → not matched
  });
});

// ─── AT-6: an added row's editors match the imported-row editors ────────────────
describe('AT-6: an added row renders the same smart editors as imported rows', () => {
  it('renders the size cell as the seven-size <select> and category/team/quarter as datalist combos', () => {
    const win = loadSimulator();
    renderTable(win);
    clickAddRow(win);

    // tshirt_size → <select> of exactly the seven Recognised t-shirt sizes.
    const sizeSelect = cellEl(win, 0, 'tshirt_size', 'select');
    expect(sizeSelect).toBeTruthy();
    expect([...sizeSelect.querySelectorAll('option')].map(o => o.value)).toEqual(SEVEN_SIZES);

    // category / team / quarter → <input list> datalist combos.
    for (const col of ['category', 'team', 'quarter']) {
      const input = cellEl(win, 0, col, 'input[list]');
      expect(input, `${col} should render a datalist combo`).toBeTruthy();
      expect(input.hasAttribute('list')).toBe(true);
      // The datalist the cell points at exists (even if empty when nothing observed).
      expect(datalistOptions(win, input)).not.toBeNull();
    }

    // Negative: free-text columns are plain inputs (no <select>, no list binding).
    for (const col of ['jira_key', 'epic_name', 'key_result']) {
      const input = cellEl(win, 0, col, 'input');
      expect(input, `${col} should render a text input`).toBeTruthy();
      expect(input.hasAttribute('list')).toBe(false);
      expect(cellEl(win, 0, col, 'select')).toBeFalsy();
    }
  });
});

// ─── AT-7: the export includes added rows ───────────────────────────────────────
describe('AT-7: ↓ Export CSV includes added-and-edited rows', () => {
  it('exports constant-work-edited.csv containing every added row with its edited values', () => {
    const win = loadSimulator();
    renderTable(win);

    // Add two rows from scratch and edit them.
    clickAddRow(win);
    clickAddRow(win);
    expect(read(win, 'editedConstantWork')).toHaveLength(2);

    expect(fillCell(win, 0, 'jira_key', 'CW-A', 'input')).toBe(true);
    expect(fillCell(win, 0, 'tshirt_size', 'M', 'select')).toBe(true);
    expect(fillCell(win, 1, 'jira_key', 'CW-B', 'input')).toBe(true);
    expect(fillCell(win, 1, 'tshirt_size', 'L', 'select')).toBe(true);

    const out = captureExport(win, 'exportConstantWorkCSV();');
    expect(out.name).toBe('constant-work-edited.csv');

    const lines = String(out.text).trim().split('\n');
    // Header (canonical schema for from-scratch rows) + exactly two data rows.
    expect(lines[0].trim()).toBe(CANONICAL_SCHEMA.join(','));
    expect(lines).toHaveLength(3);
    // Both added rows, with their edited values, are present.
    expect(out.text).toMatch(/CW-A/);
    expect(out.text).toMatch(/CW-B/);
  });
});
