// Acceptance tests for feature 0020, Phase 1: Engine substrate.
//
// Each `describe('AT-N: …')` block maps to one scenario in
// docs/plans/0020-category-and-groups.md, Phase 1 "Acceptance behavior".
//
// Tests target the public seams named in the plan:
//   • detectCategoryCol, normalizeCategory, categoryBadge (renamed from
//     detectMoscowCol / normalizeMoscow / moscowBadge);
//   • groupsStore module-scoped binding;
//   • prepareSimulationData with kPerGroup output;
//   • runSimulation accepting kPerGroup + groups and returning
//     `results: GroupResult[]`;
//   • the auto-default `All` Group inside loadInitiativesCSV;
//   • the Constant Work CSV `category → moscow → emoji` cascade;
//   • categoryBadge rendering uniform neutral grey + italic (Blank);
//   • the Initiatives-tab category cell as <input list> datalist combo;
//   • the Column-detection debug categoryCol + categoryBreakdown surfaces.
//
// Tests do NOT target internal helper names, private storage shapes, or
// implementation-incidental details.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { describe, it, expect } from 'vitest';
import { loadSimulator, read, typeOf, evalIn, execIn, csv } from '../harness.js';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const INDEX_HTML_PATH = path.resolve(here, '..', '..', 'index.html');

// ─── Fixture helpers ────────────────────────────────────────────────
// Tests construct minimal in-memory states by calling page-realm functions
// or by direct assignment to lexical bindings via execIn(). Each test loads
// a fresh window so module state does not leak between tests.

function loadInitiatives(win, rows, headers) {
  const text = csv(rows, headers);
  execIn(win, `loadInitiativesCSV(${JSON.stringify(text)})`);
}

function setEpics(win, epics) {
  // parsedEpics is a let binding — assign through evalIn directly.
  execIn(win, `parsedEpics = ${JSON.stringify(epics)};`);
}

function setGroups(win, groups) {
  execIn(win, `groupsStore.length = 0; for (const g of ${JSON.stringify(groups)}) groupsStore.push(g);`);
}

// One epic per Initiative key in the historical quarter, of size M (so
// `epicSizingDist` is non-empty and λ = 1.0). Tests that don't care about
// epic-side details use this default to make Run-pipeline calls succeed.
function defaultEpics(initKeys, quarter = 'Q1 2026') {
  return initKeys.map((k, i) => ({
    _initiative_key: k,
    _tshirt_size: 'M',
    _quarter: quarter,
    _epic_key: `EPIC-${i + 1}`,
  }));
}

function sensibleRow(jiraKey, teams, quarter, category) {
  return { jira_key: jiraKey, name: `Init ${jiraKey}`, teams, quarter, category };
}

// ─── AT-1: category header is detected as the first cascade entry ───
describe('AT-1: category header detection', () => {
  it('detects the literal `category` header via detectCategoryCol', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      sensibleRow('I-1', 'Team A', 'Q2 2026', 'Automation'),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);

    const cols = read(win, 'detectedCols');
    expect(cols.categoryCol).toBe('category');
  });
});

// ─── AT-2: moscow header is detected as the second cascade entry ───
describe('AT-2: legacy moscow header detection', () => {
  it('falls back to the `moscow` header when no `category` header is present', () => {
    const win = loadSimulator();
    const text = csv(
      [{ jira_key: 'I-1', building_block: 'BB', moscow: 'Must', teams: 'Team A', quarter: 'Q2 2026' }],
      ['jira_key', 'building_block', 'moscow', 'teams', 'quarter']
    );
    execIn(win, `loadInitiativesCSV(${JSON.stringify(text)})`);

    const cols = read(win, 'detectedCols');
    expect(cols.categoryCol).toBe('moscow');
  });
});

// ─── AT-3: emoji header is detected as the third cascade entry ──────
describe('AT-3: Quirky-format emoji header detection', () => {
  it('falls back to the `emoji` header when neither `category` nor `moscow` is present', () => {
    const win = loadSimulator();
    const text = csv(
      [{ jira_key: 'I-1', emoji: '🔴 Must', teams: 'Team A', quarter: 'Q2 2026' }],
      ['jira_key', 'emoji', 'teams', 'quarter']
    );
    execIn(win, `loadInitiativesCSV(${JSON.stringify(text)})`);

    const cols = read(win, 'detectedCols');
    expect(cols.categoryCol).toBe('emoji');
  });
});

// ─── AT-4: no header → categoryCol === null ─────────────────────────
describe('AT-4: missing category/moscow/emoji header', () => {
  it('yields categoryCol === null and every initiative resolves to the (Blank) sentinel', () => {
    const win = loadSimulator();
    const text = csv(
      [{ jira_key: 'I-1', name: 'X', teams: 'Team A', quarter: 'Q2 2026' }],
      ['jira_key', 'name', 'teams', 'quarter']
    );
    execIn(win, `loadInitiativesCSV(${JSON.stringify(text)})`);

    const cols = read(win, 'detectedCols');
    expect(cols.categoryCol).toBeNull();

    const BLANK = read(win, 'BLANK');
    expect(BLANK).toBeNull();
  });
});

// ─── AT-5: normalize trims + case-folds for equality, first casing wins
describe('AT-5: normalizeCategory equality semantics', () => {
  it('buckets Automation, automation, "Automation " under one canonical Category', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      sensibleRow('I-1', 'Team A', 'Q2 2026', 'Automation'),
      sensibleRow('I-2', 'Team A', 'Q2 2026', 'automation'),
      sensibleRow('I-3', 'Team A', 'Q2 2026', 'Automation '),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);

    setEpics(win, defaultEpics(['I-1', 'I-2', 'I-3']));
    setGroups(win, [{ name: 'All', color: '#4f46e5', members: ['Automation'], isProjection: true }]);

    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    expect(result.kPerGroup).toEqual([3]);

    // The Column-detection debug surface is also expected to expose
    // categoryBreakdown using the first-seen casing as the key.
    expect(result.preview.categoryBreakdown).toBeDefined();
    expect(result.preview.categoryBreakdown.Automation).toBe(3);
  });
});

// ─── AT-6: empty/whitespace cells → BLANK ───────────────────────────
describe('AT-6: BLANK sentinel for empty cells', () => {
  it('normalizeCategory returns BLANK for "", "   ", and undefined', () => {
    const win = loadSimulator();
    const BLANK = read(win, 'BLANK');
    expect(BLANK).toBeNull();

    expect(evalIn(win, "normalizeCategory('')")).toBeNull();
    expect(evalIn(win, "normalizeCategory('   ')")).toBeNull();
    expect(evalIn(win, 'normalizeCategory(undefined)')).toBeNull();
  });
});

// ─── AT-7: emoji characters survive normalisation ───────────────────
describe('AT-7: normalizeCategory preserves emoji', () => {
  it('returns the verbatim string for "📊 Analytics" (modulo trim)', () => {
    const win = loadSimulator();
    const out = evalIn(win, "normalizeCategory(' 📊 Analytics ')");
    expect(out).toBe('📊 Analytics');
  });
});

// ─── AT-8: first CSV load auto-creates one Group named All ──────────
describe('AT-8: auto-default All Group on first CSV load', () => {
  it('creates one Group {name:"All", color:"#4f46e5", isProjection:true, members:<observed>}', () => {
    const win = loadSimulator();
    expect(read(win, 'groupsStore')).toEqual([]);

    loadInitiatives(win, [
      sensibleRow('I-1', 'Team A', 'Q2 2026', 'Must'),
      sensibleRow('I-2', 'Team A', 'Q2 2026', 'Should'),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);

    const groups = read(win, 'groupsStore');
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('All');
    expect(groups[0].color).toBe('#4f46e5');
    expect(groups[0].isProjection).toBe(true);
    expect(new Set(groups[0].members)).toEqual(new Set(['Must', 'Should']));
  });
});

// ─── AT-9: subsequent CSV load preserves existing Groups ────────────
describe('AT-9: subsequent CSV load preserves user Groups', () => {
  it('does NOT re-create the auto-default when groupsStore is non-empty', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      sensibleRow('I-1', 'Team A', 'Q2 2026', 'Must'),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);

    // Replace the auto-default with user-defined Groups.
    setGroups(win, [
      { name: 'KR1', color: '#ea7c2c', members: ['KR1'], isProjection: true },
      { name: 'KR2', color: '#059669', members: ['KR2'], isProjection: false },
    ]);

    // Load a different CSV.
    loadInitiatives(win, [
      sensibleRow('I-2', 'Team B', 'Q3 2026', 'Automation'),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);

    const groups = read(win, 'groupsStore');
    expect(groups.map(g => g.name)).toEqual(['KR1', 'KR2']);
  });
});

// ─── AT-10: prepareSimulationData returns kPerGroup ─────────────────
describe('AT-10: prepareSimulationData kPerGroup output', () => {
  it('returns one count per Group in groupsStore order', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      sensibleRow('I-1', 'Team A', 'Q2 2026', 'Must'),
      sensibleRow('I-2', 'Team A', 'Q2 2026', 'Must'),
      sensibleRow('I-3', 'Team A', 'Q2 2026', 'Should'),
      sensibleRow('I-4', 'Team A', 'Q2 2026', 'Could'),
      sensibleRow('I-5', 'Team A', 'Q2 2026', 'Could'),
      sensibleRow('I-6', 'Team A', 'Q2 2026', 'Could'),
      sensibleRow("I-7", 'Team A', 'Q2 2026', "Won't"),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);
    setEpics(win, defaultEpics(['I-1', 'I-2', 'I-3', 'I-4', 'I-5', 'I-6', 'I-7']));
    setGroups(win, [
      { name: 'A', color: '#000', members: ['Must'], isProjection: true },
      { name: 'B', color: '#111', members: ['Should'], isProjection: false },
      { name: 'C', color: '#222', members: ['Could'], isProjection: false },
    ]);

    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    expect(result.kPerGroup).toEqual([2, 1, 3]);
  });
});

// ─── AT-11: runSimulation results: GroupResult[] shape ──────────────
describe('AT-11: runSimulation results per Group', () => {
  it('returns one {name, color, sorted, stats, hist} per Group; bins are shared', () => {
    const win = loadSimulator();
    const groups = [
      { name: 'Must', color: '#ea7c2c', members: ['Must'], isProjection: false },
      { name: 'All', color: '#4f46e5', members: ['Must', 'Should'], isProjection: true },
    ];
    const out = evalIn(win, `runSimulation({
      lambda: 1.0,
      epicSizingDist: ['M', 'M', 'M', 'M', 'M'],
      kPerGroup: [3, 7],
      capacity: 120,
      iterations: 1000,
      fixedEffort: 0,
      groups: ${JSON.stringify(groups)},
    })`);

    expect(Array.isArray(out.results)).toBe(true);
    expect(out.results).toHaveLength(2);
    expect(out.results[0].name).toBe('Must');
    expect(out.results[1].name).toBe('All');
    expect(out.results[0].color).toBe('#ea7c2c');
    expect(out.results[1].color).toBe('#4f46e5');
    expect(out.results[0].sorted).toBeInstanceOf(Float64Array);
    expect(out.results[0].stats).toMatchObject({ p10: expect.any(Number), p50: expect.any(Number), p90: expect.any(Number) });
    expect(out.results[0].hist.binCenters).toEqual(out.results[1].hist.binCenters);
  });
});

// ─── AT-12: zero-members Group → all-fixedEffort distribution ───────
describe('AT-12: zero-members Group yields fixedEffort-only distribution', () => {
  it('Float64Array of all fixedEffort with p50 === fixedEffort', () => {
    const win = loadSimulator();
    const groups = [
      { name: 'Empty', color: '#000', members: [], isProjection: false },
    ];
    const out = evalIn(win, `runSimulation({
      lambda: 1.0,
      epicSizingDist: ['M'],
      kPerGroup: [0],
      capacity: 120,
      iterations: 100,
      fixedEffort: 5,
      groups: ${JSON.stringify(groups)},
    })`);

    const empty = out.results.find(r => r.name === 'Empty');
    expect(empty.sorted).toHaveLength(100);
    for (let i = 0; i < empty.sorted.length; i++) {
      expect(empty.sorted[i]).toBe(5);
    }
    expect(empty.stats.p50).toBe(5);
  });
});

// ─── AT-13: chart datasets one per Group ────────────────────────────
describe('AT-13: org-level chart renders one dataset per Group', () => {
  it('renderChart produces a Chart instance whose data.datasets length === groupsStore.length', () => {
    const win = loadSimulator();
    const groups = [
      { name: 'Must', color: '#ea7c2c', members: ['Must'], isProjection: false },
      { name: 'All', color: '#4f46e5', members: ['Must', 'Should'], isProjection: true },
    ];
    setGroups(win, groups);

    const out = evalIn(win, `runSimulation({
      lambda: 1.0,
      epicSizingDist: ['M', 'M'],
      kPerGroup: [2, 5],
      capacity: 120,
      iterations: 200,
      fixedEffort: 0,
      groups: ${JSON.stringify(groups)},
    })`);

    execIn(win, `renderChart(${JSON.stringify(out)}, 120);`);
    const datasets = evalIn(win, 'chartInstance.data.datasets');
    expect(datasets).toHaveLength(2);
    expect(datasets[0].label).toBe('Must');
    expect(datasets[1].label).toBe('All');
    const labelText = datasets.map(d => d.label).join(' | ');
    expect(labelText).not.toMatch(/Must Only|Must \+ Should|Must \+ Should \+ Could/);
  });
});

// ─── AT-14: stats-table thead one column per Group ──────────────────
describe('AT-14: org-level stats table renders one column per Group', () => {
  it('thead has 1 + groupsStore.length <th> elements with Group names', () => {
    const win = loadSimulator();
    const groups = [
      { name: 'Must', color: '#ea7c2c', members: ['Must'], isProjection: false },
      { name: 'Must+Should', color: '#dd6b20', members: ['Must', 'Should'], isProjection: false },
      { name: 'All', color: '#4f46e5', members: ['Must', 'Should', 'Could'], isProjection: true },
    ];
    setGroups(win, groups);
    const out = evalIn(win, `runSimulation({
      lambda: 1.0,
      epicSizingDist: ['M'],
      kPerGroup: [1, 2, 3],
      capacity: 120,
      iterations: 200,
      fixedEffort: 0,
      groups: ${JSON.stringify(groups)},
    })`);
    execIn(win, `renderStatsTable(${JSON.stringify(out)}, 120);`);

    const ths = win.document.querySelectorAll('#stats-table thead th');
    expect(ths).toHaveLength(1 + groups.length);
    const headerTexts = Array.from(ths).slice(1).map(th => th.textContent.replace(/■/g, '').trim());
    expect(headerTexts).toEqual(['Must', 'Must+Should', 'All']);
    expect(headerTexts.join(' | ')).not.toMatch(/Must Only|Must \+ Should \+ Could/);
  });
});

// ─── AT-15: legacy .col-m / .col-ms / .col-msc CSS rules removed ────
describe('AT-15: legacy MSC column CSS rules removed', () => {
  it('no rule selector references .col-m, .col-ms, or .col-msc', () => {
    const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
    const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');
    expect(styleBlocks).not.toMatch(/\.col-m\b/);
    expect(styleBlocks).not.toMatch(/\.col-ms\b/);
    expect(styleBlocks).not.toMatch(/\.col-msc\b/);
  });
});

// ─── AT-16: Data preview has per-Group K rows ───────────────────────
describe('AT-16: Data preview renders one per-Group K row', () => {
  it('renderPreview emits N K-rows, one per Group, no K_must/K_must+should/K_must+should+could labels', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      sensibleRow('I-1', 'Team A', 'Q2 2026', 'Must'),
      sensibleRow('I-2', 'Team A', 'Q2 2026', 'Must'),
      sensibleRow('I-3', 'Team A', 'Q2 2026', 'Must'),
      sensibleRow('I-4', 'Team A', 'Q2 2026', 'Should'),
      sensibleRow('I-5', 'Team A', 'Q2 2026', 'Should'),
      sensibleRow('I-6', 'Team A', 'Q2 2026', 'Could'),
      sensibleRow('I-7', 'Team A', 'Q2 2026', 'Could'),
      sensibleRow('I-8', 'Team A', 'Q2 2026', 'Could'),
      sensibleRow('I-9', 'Team A', 'Q2 2026', 'Could'),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);
    setEpics(win, defaultEpics(['I-1','I-2','I-3','I-4','I-5','I-6','I-7','I-8','I-9']));
    setGroups(win, [
      { name: 'A', color: '#a', members: ['Must', 'Should'], isProjection: true },
      { name: 'B', color: '#b', members: ['Could'], isProjection: false },
    ]);

    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    execIn(win, `renderPreview(${JSON.stringify(result.preview)});`);
    const preview = win.document.getElementById('preview-pre') || win.document.getElementById('data-preview') || win.document.querySelector('.preview-content, #preview-content');
    expect(preview).toBeTruthy();
    const text = preview.textContent;
    expect(text).toMatch(/\bA\b[\s\S]*K\s*=\s*5/);
    expect(text).toMatch(/\bB\b[\s\S]*K\s*=\s*4/);
    expect(text).not.toMatch(/K_must\b|K_must\+should\b|K_must\+should\+could\b/);
  });
});

// ─── AT-17: Initiative matrix renders neutral grey category badges ──
describe('AT-17: Initiative matrix neutral grey category badges', () => {
  it('categoryBadge does not apply mb-must/mb-should/mb-could/mb-wont/mb-unknown classes', () => {
    const win = loadSimulator();
    const badges = ['Must', 'Should', 'Could', "Won't"].map(c => evalIn(win, `categoryBadge(${JSON.stringify(c)})`));
    for (const html of badges) {
      expect(html).toMatch(/Must|Should|Could|Won't/);
      expect(html).not.toMatch(/\bmb-must\b/);
      expect(html).not.toMatch(/\bmb-should\b/);
      expect(html).not.toMatch(/\bmb-could\b/);
      expect(html).not.toMatch(/\bmb-wont\b/);
      expect(html).not.toMatch(/\bmb-unknown\b/);
    }
  });
});

// ─── AT-18: empty-category Initiative badge is italic grey (Blank) ──
describe('AT-18: (Blank) badge is italic grey', () => {
  it('categoryBadge(BLANK) renders italic styling and the literal "(Blank)"', () => {
    const win = loadSimulator();
    const html = evalIn(win, 'categoryBadge(BLANK)');
    expect(html).toMatch(/\(Blank\)/);
    expect(html.toLowerCase()).toMatch(/italic|font-style\s*:\s*italic/);
  });
});

// ─── AT-19: Initiatives-tab category cell is an <input list> combo ──
describe('AT-19: Initiatives tab category cell is input list datalist combo', () => {
  it('renders <input list="category-options" …> per row and emits one <datalist> once', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      sensibleRow('I-1', 'Team A', 'Q2 2026', 'Automation'),
      sensibleRow('I-2', 'Team A', 'Q2 2026', 'KR1'),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);
    execIn(win, 'renderInitiativesTable();');

    const wrap = win.document.getElementById('initiatives-table-wrap');
    expect(wrap).toBeTruthy();

    const datalists = wrap.querySelectorAll('datalist#category-options');
    expect(datalists).toHaveLength(1);

    const categoryInputs = wrap.querySelectorAll('input[list="category-options"]');
    expect(categoryInputs.length).toBe(2);

    const optionValues = Array.from(datalists[0].querySelectorAll('option')).map(o => o.value);
    expect(new Set(optionValues)).toEqual(new Set(['Automation', 'KR1']));
    expect(optionValues).not.toContain('(Blank)');
  });
});

// ─── AT-20: typing new category writes through to editedInitiatives ─
describe('AT-20: free-text Category typed in datalist combo writes through', () => {
  it('after onchange fires, editedInitiatives[idx][categoryCol] === typed string', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      sensibleRow('I-1', 'Team A', 'Q2 2026', 'Must'),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);
    execIn(win, 'renderInitiativesTable();');

    const input = win.document.querySelector('#initiatives-table-wrap input[list="category-options"]');
    expect(input).toBeTruthy();
    input.value = 'Project ABC';
    input.dispatchEvent(new win.Event('change', { bubbles: true }));

    const edited = read(win, 'editedInitiatives');
    const cols = read(win, 'detectedCols');
    expect(edited[0][cols.categoryCol]).toBe('Project ABC');
  });
});

// ─── AT-21: Constant Work CSV category cascade ──────────────────────
describe('AT-21: Constant Work CSV cascade category→moscow→emoji', () => {
  it('getConstantWorkEpics resolves the row\'s category via the cascade', () => {
    const win = loadSimulator();
    // Migrated for feature 0021 Phase 1: getConstantWorkEpics now reads
    // `editedConstantWork` (the simulation source of truth), so the row is
    // mounted there rather than on the immutable `parsedConstantWork`.
    execIn(win, `editedConstantWork = [{
      team: 'Team A',
      quarter: 'Q2 2026',
      t_shirt_size: 'M',
      category: 'KR1',
      name: 'Locked work',
      jira_key: 'CW-1',
    }];`);

    const epics = evalIn(win, "getConstantWorkEpics('Q2 2026', 'Team A')");
    expect(Array.isArray(epics)).toBe(true);
    expect(epics).toHaveLength(1);
    // The epic should carry the normalised category KR1, however the engine
    // names the field (`category`, `_category`, etc.). Use a structural match
    // against any value-bearing field.
    const flattened = JSON.stringify(epics[0]);
    expect(flattened).toMatch(/KR1/);
  });
});

// ─── AT-22: auto-default All Group includes BLANK when needed ───────
describe('AT-22: auto-default All Group includes (Blank) sentinel', () => {
  it('members contains BLANK when any Initiative has an empty category cell', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      sensibleRow('I-1', 'Team A', 'Q2 2026', 'Must'),
      sensibleRow('I-2', 'Team A', 'Q2 2026', ''),
      sensibleRow('I-3', 'Team A', 'Q2 2026', 'Could'),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);

    const groups = read(win, 'groupsStore');
    expect(groups).toHaveLength(1);
    expect(new Set(groups[0].members)).toEqual(new Set(['Must', 'Could', null]));
  });
});

// ─── AT-23: first Run with auto-default All covers every Initiative ─
describe('AT-23: auto-default All Group → single Scenario covering all', () => {
  it('kPerGroup[0] === total target-quarter initiative count', () => {
    const win = loadSimulator();
    const initRows = [];
    for (let i = 1; i <= 10; i++) {
      const cat = ['Must', 'Should', 'Could', "Won't"][i % 4];
      initRows.push(sensibleRow(`I-${i}`, 'Team A', 'Q2 2026', cat));
    }
    loadInitiatives(win, initRows, ['jira_key', 'name', 'category', 'teams', 'quarter']);
    setEpics(win, defaultEpics(initRows.map(r => r.jira_key)));

    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    expect(result.kPerGroup).toEqual([10]);
    const groups = read(win, 'groupsStore');
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('All');
  });
});

// ─── AT-24: buckets no Group references contribute zero ─────────────
describe('AT-24: unreferenced Category buckets are excluded', () => {
  it('initiatives in Categories absent from any Group.members do not influence any Scenario', () => {
    const win = loadSimulator();
    const initRows = [];
    for (let i = 1; i <= 3; i++) initRows.push(sensibleRow(`I-${i}`, 'Team A', 'Q2 2026', 'Must'));
    for (let i = 4; i <= 10; i++) initRows.push(sensibleRow(`I-${i}`, 'Team A', 'Q2 2026', 'Should'));
    loadInitiatives(win, initRows, ['jira_key', 'name', 'category', 'teams', 'quarter']);
    setEpics(win, defaultEpics(initRows.map(r => r.jira_key)));
    setGroups(win, [
      { name: 'Critical', color: '#000', members: ['Must'], isProjection: true },
    ]);

    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    expect(result.kPerGroup).toEqual([3]);
  });
});

// ─── AT-25: Team Level tab renders one column per Group ─────────────
describe('AT-25: Team Level tab stats table has one column per Group', () => {
  it('renderStatsTableInto emits 1 + groupsStore.length headers for a team tbody', () => {
    const win = loadSimulator();
    const groups = [
      { name: 'A', color: '#a', members: ['Must'], isProjection: true },
      { name: 'B', color: '#b', members: ['Should'], isProjection: false },
    ];
    setGroups(win, groups);

    // Mount a minimal stats-tbody container for a team.
    win.document.body.insertAdjacentHTML('beforeend', `
      <table><thead id="team-stats-thead-0"></thead><tbody id="team-stats-tbody-0"></tbody></table>
    `);

    const out = evalIn(win, `runSimulation({
      lambda: 1.0,
      epicSizingDist: ['M'],
      kPerGroup: [1, 2],
      capacity: 120,
      iterations: 200,
      fixedEffort: 0,
      groups: ${JSON.stringify(groups)},
    })`);
    execIn(win, `renderStatsTableInto('team-stats-tbody-0', ${JSON.stringify(out)}, 120, 'team-0');`);

    const firstRow = win.document.querySelector('#team-stats-tbody-0 tr');
    expect(firstRow).toBeTruthy();
    expect(firstRow.querySelectorAll('td')).toHaveLength(1 + groups.length);
  });
});

// ─── AT-26: buildTeamProjections reads the Projection group ─────────
describe('AT-26: buildTeamProjections drives band from the Projection Group', () => {
  it('a zero-member Projection Group collapses the band to cwEffort even when MSC has non-zero count', () => {
    const win = loadSimulator();
    // Ten Must initiatives in the target quarter — pre-impl MSC counts these
    // and yields a non-trivial Monte Carlo band. Post-impl, the Projection
    // group has members [] so K === 0 and the band must collapse to the
    // cwEffort triple (here 0).
    const rows = [];
    for (let i = 1; i <= 10; i++) rows.push(sensibleRow(`I-${i}`, 'Team A', 'Q2 2026', 'Must'));
    loadInitiatives(win, rows, ['jira_key', 'name', 'category', 'teams', 'quarter']);
    setEpics(win, defaultEpics(rows.map(r => r.jira_key)));
    setGroups(win, [
      { name: 'Empty', color: '#000', members: [], isProjection: true },
    ]);

    const proj = evalIn(win, "buildTeamProjections(['Q2 2026'], 1.0, ['M', 'M', 'M', 'M', 'M'], 500)");
    expect(Array.isArray(proj)).toBe(true);
    expect(proj.length).toBeGreaterThan(0);
    const cell = proj[0].byQuarter['Q2 2026'];
    expect(cell).toBeTruthy();
    // Flat band invariant: p25 === p50 === p75 === cwEffort (0 here).
    expect(cell.p25).toBe(cell.p75);
    expect(cell.p50).toBe(cell.p25);
    expect(cell.p50).toBe(cell.cwEffort);
  });
});

// ─── AT-27: empty groupsStore → cwEffort-only flat band ─────────────
describe('AT-27: empty groupsStore falls back to cwEffort-only band', () => {
  it('every projection band collapses to the constant-work-only triple when groupsStore === []', () => {
    const win = loadSimulator();
    // Ten Must initiatives + one constant-work row. With an empty groupsStore
    // there is no Projection group, so each band collapses to the flat
    // (cwEffort, cwEffort, cwEffort) triple.
    //
    // Migrated for feature 0021 Phase 1: the constant work is mounted on
    // `editedConstantWork` (the simulation source of truth that
    // buildTeamProjections / getConstantWorkEpics now read) rather than on the
    // immutable `parsedConstantWork`. cwEffort must therefore be the deterministic
    // person-months of the edited row — non-zero — proving the read goes through
    // the substrate.
    const rows = [];
    for (let i = 1; i <= 10; i++) rows.push(sensibleRow(`I-${i}`, 'Team A', 'Q2 2026', 'Must'));
    loadInitiatives(win, rows, ['jira_key', 'name', 'category', 'teams', 'quarter']);
    setEpics(win, defaultEpics(rows.map(r => r.jira_key)));
    execIn(win, `editedConstantWork = [{
      team: 'Team A',
      quarter: 'Q2 2026',
      t_shirt_size: 'M',
      category: 'Must',
      name: 'CW',
      jira_key: 'CW-1',
    }];`);
    execIn(win, 'groupsStore.length = 0;');

    const proj = evalIn(win, "buildTeamProjections(['Q2 2026'], 1.0, ['M'], 500)");
    expect(proj.length).toBeGreaterThan(0);
    const cell = proj[0].byQuarter['Q2 2026'];
    expect(cell).toBeTruthy();
    // cwEffort reflects the editedConstantWork row's M size (non-zero).
    expect(cell.cwEffort).toBe(evalIn(win, "tshirtToPersonMonths('M')"));
    expect(cell.cwEffort).toBeGreaterThan(0);
    // Flat band: p25 === p50 === p75 === cwEffort.
    expect(cell.p25).toBe(cell.cwEffort);
    expect(cell.p50).toBe(cell.cwEffort);
    expect(cell.p75).toBe(cell.cwEffort);
  });
});

// ─── AT-28: overlap counts in each Group ────────────────────────────
describe('AT-28: overlapping Group membership counts in every match', () => {
  it('an Initiative in a Category present in multiple Groups contributes to each K', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      sensibleRow('I-1', 'Team A', 'Q2 2026', 'Should'),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);
    setEpics(win, defaultEpics(['I-1']));
    setGroups(win, [
      { name: 'A', color: '#a', members: ['Must', 'Should'], isProjection: true },
      { name: 'B', color: '#b', members: ['Should', 'Could'], isProjection: false },
    ]);

    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    expect(result.kPerGroup).toEqual([1, 1]);
  });
});

// ─── AT-29: subsequent reload does not re-sync auto-default ─────────
describe('AT-29: subsequent CSV (re)load does NOT re-sync the existing All Group', () => {
  it('the auto-default fires once; later loads leave the existing Group untouched', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      sensibleRow('I-1', 'Team A', 'Q2 2026', 'Must'),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);

    const firstMembers = JSON.parse(JSON.stringify(read(win, 'groupsStore')[0].members));
    expect(firstMembers).toEqual(['Must']);

    // Reset only the file (per AT-30 contract: resetInitiativesFile does not
    // touch groupsStore). Then load a different CSV. The existing All Group's
    // members must remain ['Must'], not be re-synced to the new file.
    execIn(win, 'resetInitiativesFile();');
    loadInitiatives(win, [
      sensibleRow('I-2', 'Team A', 'Q3 2026', 'KR99'),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);

    const after = read(win, 'groupsStore');
    expect(after).toHaveLength(1);
    expect(after[0].members).toEqual(['Must']);
  });
});

// ─── AT-30: resetInitiativesFile does NOT reset groupsStore ─────────
describe('AT-30: resetInitiativesFile leaves groupsStore intact', () => {
  it('CSV reset clears parsedInitiatives but not Groups', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      sensibleRow('I-1', 'Team A', 'Q2 2026', 'Must'),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);

    const beforeGroups = JSON.parse(JSON.stringify(read(win, 'groupsStore')));
    expect(beforeGroups.length).toBeGreaterThan(0);

    execIn(win, 'resetInitiativesFile();');
    expect(read(win, 'parsedInitiatives')).toBeNull();
    expect(read(win, 'editedInitiatives')).toBeNull();
    expect(read(win, 'detectedCols')).toBeNull();
    expect(read(win, 'groupsStore')).toEqual(beforeGroups);
  });
});
