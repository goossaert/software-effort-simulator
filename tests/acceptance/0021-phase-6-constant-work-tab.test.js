// Acceptance tests for feature 0021, Phase 6:
//   Constant work tab — an editable table with smart per-field editors and CSV
//   export, modelled on the Initiatives tab but with ALL cells editable.
//
// Each `describe('AT-N: …')` block maps to one scenario in
// docs/plans/0021-constant-work-tab-and-group-scoping.md, Phase 6
// "Acceptance behavior".
//
// Behavioral rule under test (ADR-0034):
//   A sixth **Tab** — **Constant work** (`#tab-constant-work`) — is inserted
//   after **Initiatives** in the tab bar (fifth button, before **Groups**) and
//   renders `editedConstantWork` via `renderConstantWorkTable()`. Unlike the
//   Initiatives tab, *all* cells are editable. The `tshirt_size` (and the
//   `t_shirt_size` alias) cell is a `<select>` constrained to exactly the seven
//   **Recognised t-shirt sizes** (`2XS, XS, S, M, L, XL, XL+`), closing the
//   silent-0-PM footgun. The `category`, `team`, and `quarter` cells (and
//   recognised aliases) are `<input list>` datalist combos seeded from the
//   observed union of `editedInitiatives` and `editedConstantWork` values. The
//   `jira_key`, `epic_name`, `key_result`, and any unknown extra columns are
//   free-text inputs. Edits commit to `editedConstantWork` immediately via inline
//   `onchange` handlers (which also call `tryUpdatePreview`), but charts/stats lag
//   until the next **Run** (commit-on-Run). A `↓ Export CSV` toolbar button calls
//   `exportConstantWorkCSV()` → `Papa.unparse(editedConstantWork)` → download
//   `constant-work-edited.csv`, preserving the imported header set verbatim
//   (aliases + extra columns). Cell text is `escapeHtml`'d; attribute values are
//   `escapeAttr`'d.
//
// Seams targeted (autonomously chosen — see the atdd handover):
//   • The sixth tab markup: `<button class="tab-btn" data-tab="constant-work">`
//     and `<div id="tab-constant-work">` containing `#constant-work-table-wrap`.
//   • `renderConstantWorkTable()` writing a single `<table>` into
//     `#constant-work-table-wrap`.
//   • The size `<select>` option set (the seven Recognised t-shirt sizes); the
//     `<input list>` datalist combos for category/team/quarter.
//   • `exportConstantWorkCSV()` producing `constant-work-edited.csv` from
//     `Papa.unparse(editedConstantWork)`.
// These do NOT lock in: the exact CSS class names / datalist `id`s (resolved
// dynamically through each input's `list` attribute); the exact wording of the
// toolbar; whether the datalist-union helper is shared with the Members popover
// (Phase 8). Per the plan's "Do NOT lock in" list.

import { describe, it, expect } from 'vitest';
import { loadSimulator, read, evalIn, execIn, csv } from '../harness.js';

const SEVEN_SIZES = ['2XS', 'XS', 'S', 'M', 'L', 'XL', 'XL+'];

// ─── Fixture helpers ────────────────────────────────────────────────
const INIT_HEADERS = ['jira_key', 'building_block', 'category', 'teams', 'quarter'];

function initiativeRow(jiraKey, teams, quarter, category) {
  return { jira_key: jiraKey, building_block: `Init ${jiraKey}`, category, teams, quarter };
}

function loadInitiatives(win, rows, headers = INIT_HEADERS) {
  execIn(win, `loadInitiativesCSV(${JSON.stringify(csv(rows, headers))})`);
}

// Mount constant-work rows directly on the simulation source of truth
// (`editedConstantWork`, the Phase 1 substrate) — the array the tab renders.
function setConstantWork(win, rows) {
  execIn(win, `editedConstantWork = ${JSON.stringify(rows)};`);
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

// Capture the text Papa.unparse wrote into the Blob AND the download filename
// the export anchor targeted — mirrors the Phase-3 JSON-persistence export test.
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

// ─── AT-1: a sixth Constant work tab button after Initiatives ──────────────────
// Migrated for feature 0023 Phase 1, which appends a seventh Error Report tab as
// the last .tab-btn. Constant work stays fifth and Groups sixth; Error Report is
// now last. The invariant under test (Constant work is fifth, immediately before
// Groups) is unchanged.
describe('AT-1: a sixth Constant work tab button appears after Initiatives and before Groups', () => {
  it('renders seven .tab-btn elements in order with Constant work fifth (data-tab="constant-work"), Groups sixth, and Error Report last', () => {
    const win = loadSimulator();
    const buttons = Array.from(win.document.querySelectorAll('.tab-btn'));
    expect(buttons).toHaveLength(7);
    expect(buttons.map(b => b.dataset.tab)).toEqual([
      'org', 'teams', 'projections', 'initiatives', 'constant-work', 'groups', 'error-report',
    ]);
    const fifth = buttons[4];
    expect(fifth.dataset.tab).toBe('constant-work');
    expect(fifth.textContent.trim()).toBe('Constant work');
    // Negative: Constant work must sit immediately before Groups (sixth).
    expect(buttons[5].dataset.tab).toBe('groups');
  });
});

// ─── AT-2: the #tab-constant-work panel is hidden with Organization Level active ──
describe('AT-2: the #tab-constant-work panel is hidden after a Run with Organization Level active', () => {
  it('the panel exists, is display:none, and the active tab button is Organization Level', () => {
    const win = loadSimulator();
    const panel = win.document.getElementById('tab-constant-work');
    expect(panel).toBeTruthy();
    expect(panel.classList.contains('tab-panel')).toBe(true);
    expect(panel.style.display).toBe('none');
    // The default/after-Run active tab is Organization Level.
    const active = win.document.querySelector('.tab-btn.active');
    expect(active).toBeTruthy();
    expect(active.dataset.tab).toBe('org');
  });
});

// ─── AT-3: clicking the tab reveals one row per editedConstantWork row ─────────
describe('AT-3: clicking the Constant work tab reveals the table with one row per editedConstantWork row', () => {
  it('switches #tab-constant-work to display:flex and renders one tbody <tr> per row', () => {
    const win = loadSimulator();
    setConstantWork(win, [
      { jira_key: 'CW-1', epic_name: 'A', category: 'Backend', team: 'Platform', quarter: 'Q3 2026', tshirt_size: 'M' },
      { jira_key: 'CW-2', epic_name: 'B', category: 'Frontend', team: 'Web', quarter: 'Q3 2026', tshirt_size: 'L' },
      { jira_key: 'CW-3', epic_name: 'C', category: 'Ops', team: 'Platform', quarter: 'Q4 2026', tshirt_size: 'S' },
    ]);
    renderTable(win);

    const btn = win.document.querySelector('.tab-btn[data-tab="constant-work"]');
    expect(btn).toBeTruthy();
    btn.click();

    expect(win.document.getElementById('tab-constant-work').style.display).toBe('flex');
    expect(bodyRows(win)).toHaveLength(3);
  });

  it('renders a single tbody <tr> when editedConstantWork has exactly one row (boundary)', () => {
    const win = loadSimulator();
    setConstantWork(win, [
      { jira_key: 'CW-1', epic_name: 'A', category: 'Backend', team: 'Platform', quarter: 'Q3 2026', tshirt_size: 'M' },
    ]);
    renderTable(win);
    expect(bodyRows(win)).toHaveLength(1);
  });
});

// ─── AT-4: the tshirt_size cell is a <select> of exactly the seven sizes ───────
describe('AT-4: the tshirt_size cell is a <select> of exactly the seven Recognised t-shirt sizes', () => {
  it('renders a <select> whose options are exactly 2XS,XS,S,M,L,XL,XL+ with the row value M selected', () => {
    const win = loadSimulator();
    setConstantWork(win, [
      { jira_key: 'CW-1', epic_name: 'A', category: 'Backend', team: 'Platform', quarter: 'Q3 2026', tshirt_size: 'M' },
    ]);
    renderTable(win);

    const select = cellEl(win, 0, 'tshirt_size', 'select');
    expect(select).toBeTruthy();
    const optionValues = [...select.querySelectorAll('option')].map(o => o.value);
    expect(optionValues).toEqual(SEVEN_SIZES);
    expect(select.value).toBe('M');
  });

  it('treats the t_shirt_size alias column as a size <select> too', () => {
    const win = loadSimulator();
    setConstantWork(win, [
      { jira_key: 'CW-1', epic_name: 'A', category: 'Backend', team: 'Platform', quarter: 'Q3 2026', t_shirt_size: 'L' },
    ]);
    renderTable(win);

    const select = cellEl(win, 0, 't_shirt_size', 'select');
    expect(select).toBeTruthy();
    expect([...select.querySelectorAll('option')].map(o => o.value)).toEqual(SEVEN_SIZES);
    expect(select.value).toBe('L');
  });

  it('keeps the seven canonical sizes present even when the imported value is unrecognised (boundary)', () => {
    const win = loadSimulator();
    setConstantWork(win, [
      { jira_key: 'CW-1', epic_name: 'A', category: 'Backend', team: 'Platform', quarter: 'Q3 2026', tshirt_size: 'XXL' },
    ]);
    renderTable(win);

    const select = cellEl(win, 0, 'tshirt_size', 'select');
    expect(select).toBeTruthy();
    const optionValues = [...select.querySelectorAll('option')].map(o => o.value);
    // Property: the seven canonical sizes are always present …
    for (const s of SEVEN_SIZES) expect(optionValues).toContain(s);
    // … and the unrecognised current value is shown (and selected) so it is not silently lost.
    expect(optionValues).toContain('XXL');
    expect(select.value).toBe('XXL');
  });
});

// ─── AT-5: category/team/quarter are datalist combos seeded from the union ─────
describe('AT-5: the category, team, and quarter cells are <input list> datalist combos seeded from the observed union', () => {
  it('seeds the category datalist from the union of initiative and constant-work Categories', () => {
    const win = loadSimulator();
    // Initiatives carry Categories {A, B}; constant work carries Category {C}.
    loadInitiatives(win, [
      initiativeRow('I-1', 'Platform', 'Q2 2026', 'A'),
      initiativeRow('I-2', 'Web', 'Q3 2026', 'B'),
    ]);
    setConstantWork(win, [
      { jira_key: 'CW-1', epic_name: 'X', category: 'C', team: 'Mobile', quarter: 'Q4 2026', tshirt_size: 'M' },
    ]);
    renderTable(win);

    const catInput = cellEl(win, 0, 'category', 'input[list]');
    expect(catInput).toBeTruthy();
    const opts = datalistOptions(win, catInput);
    // Happy + property: the union of both sources is offered.
    expect(opts).toContain('A'); // initiative-only
    expect(opts).toContain('B'); // initiative-only
    expect(opts).toContain('C'); // constant-work-only
  });

  it('renders team and quarter as datalist combos seeded from the union of initiative and constant-work values', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      initiativeRow('I-1', 'Platform', 'Q2 2026', 'A'),
    ]);
    setConstantWork(win, [
      { jira_key: 'CW-1', epic_name: 'X', category: 'C', team: 'Mobile', quarter: 'Q4 2026', tshirt_size: 'M' },
    ]);
    renderTable(win);

    const teamInput = cellEl(win, 0, 'team', 'input[list]');
    expect(teamInput).toBeTruthy();
    const teamOpts = datalistOptions(win, teamInput);
    expect(teamOpts).toContain('Mobile');   // constant-work value
    expect(teamOpts).toContain('Platform');  // initiative value (union)

    const quarterInput = cellEl(win, 0, 'quarter', 'input[list]');
    expect(quarterInput).toBeTruthy();
    const quarterOpts = datalistOptions(win, quarterInput);
    expect(quarterOpts).toContain('Q4 2026'); // constant-work value
    expect(quarterOpts).toContain('Q2 2026'); // initiative value (union)
  });
});

// ─── AT-6: jira_key / epic_name / key_result / extra columns are free text ─────
describe('AT-6: the jira_key, epic_name, key_result, and unknown extra columns are free-text inputs', () => {
  it('renders each as a plain text input (no <select>, no datalist list attribute)', () => {
    const win = loadSimulator();
    setConstantWork(win, [
      {
        jira_key: 'CW-1', epic_name: 'Some epic', key_result: 'KR-7',
        category: 'Backend', team: 'Platform', quarter: 'Q3 2026', tshirt_size: 'M',
        notes: 'free text here',
      },
    ]);
    renderTable(win);

    for (const col of ['jira_key', 'epic_name', 'key_result', 'notes']) {
      const idx = headerIndex(win, col);
      expect(idx, `column ${col} should be present`).toBeGreaterThanOrEqual(0);
      const td = bodyRows(win)[0].querySelectorAll('td')[idx];
      const input = td.querySelector('input');
      expect(input, `column ${col} should render a text input`).toBeTruthy();
      expect(input.getAttribute('type') === null || input.getAttribute('type') === 'text').toBe(true);
      // Negative: a free-text cell has no datalist binding and no <select>.
      expect(input.hasAttribute('list')).toBe(false);
      expect(td.querySelector('select')).toBeFalsy();
    }
  });
});

// ─── AT-7: editing the size <select> writes through and flows into the next Run ──
describe('AT-7: editing the tshirt_size <select> writes through to editedConstantWork and flows into the next Run', () => {
  it('updates editedConstantWork immediately, lags the chart, and contributes the new size PM to its Group on the next Run', () => {
    const win = loadSimulator();
    execIn(win, `groupsStore.length = 0; for (const g of ${JSON.stringify([
      { name: 'Backend', color: '#a', members: ['Backend'], isProjection: true },
    ])}) groupsStore.push(g);`);
    setConstantWork(win, [
      { jira_key: 'CW-1', epic_name: 'A', category: 'Backend', team: 'Platform', quarter: 'Q3 2026', tshirt_size: 'M' },
    ]);
    renderTable(win);

    // The chart has not been built (commit-on-Run): capture its state before editing.
    const beforeChart = evalIn(win, 'typeof chartInstance');

    const select = cellEl(win, 0, 'tshirt_size', 'select');
    expect(select).toBeTruthy();
    select.value = 'XL';
    select.dispatchEvent(new win.Event('change', { bubbles: true }));

    // Immediate write-through to the simulation source of truth.
    expect(read(win, 'editedConstantWork')[0].tshirt_size).toBe('XL');
    // Commit-on-Run: no Run fired, so the chart is unchanged.
    expect(evalIn(win, 'typeof chartInstance')).toBe(beforeChart);

    // On the next Run the edited size contributes its PM to the Backend Group's shift.
    const vector = evalIn(
      win,
      `getConstantWorkEffortPerGroup(${JSON.stringify(['Q3 2026'])}, groupsStore)`
    );
    expect(vector[0]).toBeCloseTo(pm(win, 'XL'), 10);
    expect(vector[0]).not.toBeCloseTo(pm(win, 'M'), 10);
  });
});

// ─── AT-8: Export CSV downloads constant-work-edited.csv with imported headers ──
describe('AT-8: ↓ Export CSV downloads constant-work-edited.csv preserving the imported header set', () => {
  it('triggers a constant-work-edited.csv download whose header row is exactly the imported headers (aliases + extras, original order)', () => {
    const win = loadSimulator();
    const headers = ['epic_key', 'building_block', 't_shirt_size', 'category', 'team', 'quarter', 'notes'];
    const text = csv([
      { epic_key: 'CW-1', building_block: 'Block A', t_shirt_size: 'M', category: 'Backend', team: 'Platform', quarter: 'Q3 2026', notes: 'n1' },
    ], headers);
    execIn(win, `loadConstantWorkCSV(${JSON.stringify(text)})`);
    renderTable(win);

    // Click the actual toolbar button so the export is user-driven.
    const exportBtn = Array.from(
      win.document.querySelectorAll('#tab-constant-work button, #constant-work-table-wrap button')
    ).find(b => /export csv/i.test(b.textContent));
    expect(exportBtn, 'an ↓ Export CSV toolbar button should exist').toBeTruthy();

    const out = captureExport(win, 'document.querySelector(".tab-btn"); exportConstantWorkCSV();');
    expect(out.name).toBe('constant-work-edited.csv');
    const headerLine = String(out.text).split('\n')[0].trim();
    // Exactly the imported headers, in their original order — no alias normalisation, no reorder.
    expect(headerLine).toBe(headers.join(','));
    // Negative: aliases were NOT rewritten to canonical names.
    expect(headerLine).not.toMatch(/\btshirt_size\b/);
    expect(headerLine).not.toMatch(/\bjira_key\b/);
  });
});

// ─── AT-9: the exported CSV round-trips ────────────────────────────────────────
describe('AT-9: the exported Constant Work CSV round-trips through re-import', () => {
  it('reproduces the edited model (same columns and edited values) when the export is re-imported', () => {
    const win = loadSimulator();
    const headers = ['epic_key', 'building_block', 't_shirt_size', 'category', 'team', 'quarter'];
    const text = csv([
      { epic_key: 'CW-1', building_block: 'Block A', t_shirt_size: 'M', category: 'Backend', team: 'Platform', quarter: 'Q3 2026' },
    ], headers);
    execIn(win, `loadConstantWorkCSV(${JSON.stringify(text)})`);
    // Edit a couple of cells on the edited model.
    execIn(win, `editedConstantWork[0].category = 'Edited'; editedConstantWork[0].t_shirt_size = 'XL';`);

    const out = captureExport(win, 'exportConstantWorkCSV();');
    expect(out.text).toBeTruthy();

    // Re-import the exported text.
    execIn(win, `loadConstantWorkCSV(${JSON.stringify('PLACEHOLDER')})`.replace('"PLACEHOLDER"', JSON.stringify(out.text)));
    const reparsed = read(win, 'parsedConstantWork');
    expect(reparsed).toHaveLength(1);
    expect(Object.keys(reparsed[0])).toEqual(headers);
    expect(reparsed[0].category).toBe('Edited');
    expect(reparsed[0].t_shirt_size).toBe('XL');
  });
});

// ─── AT-10: editing a cell refreshes the preview but does not Run ──────────────
describe('AT-10: editing a Constant work cell triggers a preview refresh but not a Run', () => {
  it('invokes tryUpdatePreview on change and never calls runSimulation (chart/stats stay put)', () => {
    const win = loadSimulator();
    setConstantWork(win, [
      { jira_key: 'CW-1', epic_name: 'A', category: 'Backend', team: 'Platform', quarter: 'Q3 2026', tshirt_size: 'M' },
    ]);
    renderTable(win);

    // Spy on the preview-refresh seam by reassigning the page-scope binding.
    execIn(win, 'window.__previewCalls = 0; tryUpdatePreview = function () { window.__previewCalls++; };');
    const beforeChart = evalIn(win, 'typeof chartInstance');

    const select = cellEl(win, 0, 'tshirt_size', 'select');
    expect(select).toBeTruthy();
    select.value = 'L';
    select.dispatchEvent(new win.Event('change', { bubbles: true }));

    // Preview refresh fired …
    expect(evalIn(win, 'window.__previewCalls')).toBeGreaterThan(0);
    // … but no Run: the chart instance is unchanged.
    expect(evalIn(win, 'typeof chartInstance')).toBe(beforeChart);
    // The committed edit is on editedConstantWork (not gated behind a Run).
    expect(read(win, 'editedConstantWork')[0].tshirt_size).toBe('L');
  });
});

// ─── AT-11: cell values are HTML-escaped ───────────────────────────────────────
describe('AT-11: Constant work cell values are escaped (escapeHtml / escapeAttr)', () => {
  it('renders a script-injection payload as inert text with no <script> element added', () => {
    const win = loadSimulator();
    const payload = `<script>alert('x')</scr` + `ipt>`;
    setConstantWork(win, [
      { jira_key: 'CW-1', epic_name: payload, category: 'Backend', team: 'Platform', quarter: 'Q3 2026', tshirt_size: 'M' },
    ]);
    renderTable(win);

    const wrap = win.document.getElementById('constant-work-table-wrap');
    expect(wrap).toBeTruthy();
    // No live <script> element was injected by the render.
    expect(wrap.querySelectorAll('script')).toHaveLength(0);
    // The payload survives as inert data: the free-text input's value is the literal string.
    const input = cellEl(win, 0, 'epic_name', 'input');
    expect(input).toBeTruthy();
    expect(input.value).toBe(payload);
  });
});
