// Acceptance tests for feature 0021, Phase 5:
//   Constant-work quarters in the Target selector + Data preview surfacing of
//   per-Group constant-work PM and exclusions.
//
// Each `describe('AT-N: …')` block maps to one scenario in
// docs/plans/0021-constant-work-tab-and-group-scoping.md, Phase 5
// "Acceptance behavior".
//
// Behavioral rule under test (ADR-0033):
//   The **Target quarter** selector's source becomes
//   `initiatives ∪ epics ∪ editedConstantWork` quarters; the **Historical
//   quarter** selector's source stays `initiatives ∪ epics` (Constant work
//   cannot inform **Poisson λ** or the **Bootstrap pool**). The two `MultiSelect`
//   instances are populated from different lists in `refreshQuarters`. A
//   **Target quarter** present only in constant work yields a pure-constant-work
//   forecast (`kPerGroup` all 0, each Group flat at its own `fixedEffortPerGroup`
//   entry). The **Data preview** surfaces, beside each per-Group `K` row, the
//   constant-work person-months folded into that Group
//   (`preview.fixedEffortPerGroup`), plus a dedicated line reporting any constant
//   work in the target quarters whose **Category** matches no Group's members
//   (`preview.cwExcludedPM` / `preview.cwExcludedRows`, "excluded"). The
//   exclusion count is overlap-aware: a row counts as excluded only if it is in
//   *no* Group. Surfacing is preview-only — no Run gate, no alert.
//
// Seams targeted (autonomously chosen — see the atdd handover):
//   • `refreshQuarters()` populating the Target `MultiSelect` (`#target-ms`) from
//     a list that includes constant-work quarters and the Historical `MultiSelect`
//     (`#hist-ms`) from one that does not. Read through the rendered option
//     checkboxes in each widget's `.ms-options-wrap` (the user-observable option
//     list) — NOT a private widget field.
//   • `prepareSimulationData(hist, target).preview` gaining the plan-named fields
//     `fixedEffortPerGroup`, `cwExcludedPM`, `cwExcludedRows`.
//   • `renderPreview(preview)` surfacing the per-Group constant-work PM and an
//     "excluded" line in `#preview-grid` text.
// These do NOT lock in: the exact wording / number formatting of the per-Group PM
// or the excluded line (asserted only for presence + the precise values on the
// `preview` object); whether the excluded summary is computed inside
// `prepareSimulationData` or a small helper.

import { describe, it, expect } from 'vitest';
import { loadSimulator, evalIn, execIn, csv } from '../harness.js';

// ─── Fixture helpers ────────────────────────────────────────────────
const INIT_HEADERS = ['jira_key', 'building_block', 'category', 'teams', 'quarter'];

function initiativeRow(jiraKey, teams, quarter, category) {
  return { jira_key: jiraKey, building_block: `Init ${jiraKey}`, category, teams, quarter };
}

function loadInitiatives(win, rows, headers = INIT_HEADERS) {
  execIn(win, `loadInitiativesCSV(${JSON.stringify(csv(rows, headers))})`);
}

// Epics carry an explicit `_quarter` so `refreshQuarters` and the λ scan see
// them. Constant work must NOT influence λ / the bootstrap pool.
function setEpics(win, epics) {
  execIn(win, `parsedEpics = ${JSON.stringify(epics)};`);
}

function defaultEpics(initKeys, quarter = 'Q2 2026') {
  return initKeys.map((k, i) => ({
    _initiative_key: k, _tshirt_size: 'M', _quarter: quarter, _epic_key: `EPIC-${i + 1}`,
  }));
}

// Replace `groupsStore` wholesale (a literal `[]` clears it). Done AFTER
// `loadInitiativesCSV` so the auto-default `All` Group created at load time is
// overwritten by the exact Group snapshot under test.
function setGroups(win, groups) {
  execIn(win, `groupsStore.length = 0; for (const g of ${JSON.stringify(groups)}) groupsStore.push(g);`);
}

// Mount constant-work rows directly on the simulation source of truth
// (`editedConstantWork`, the Phase 1 substrate) — the array the Target selector
// and the preview both read.
function setConstantWork(win, rows) {
  execIn(win, `editedConstantWork = ${JSON.stringify(rows)};`);
}

function refreshQuarters(win) {
  execIn(win, `refreshQuarters();`);
}

// The user-observable option list of a `MultiSelect` widget: the `value` of each
// rendered checkbox in its `.ms-options-wrap`.
function selectorOptions(win, wrapperId) {
  return evalIn(
    win,
    `[...document.querySelectorAll('#${wrapperId} .ms-options-wrap input[type=checkbox]')].map(cb => cb.value)`
  );
}

// The Data preview object reported by the plan's stable seam.
function previewOf(win, histQuarters, targetQuarters) {
  return evalIn(
    win,
    `prepareSimulationData(${JSON.stringify(histQuarters)}, ${JSON.stringify(targetQuarters)}).preview`
  );
}

// Render the Data preview and return the `#preview-grid` text the user sees.
function renderedPreviewText(win, histQuarters, targetQuarters) {
  return execIn(win, `
    const r = prepareSimulationData(${JSON.stringify(histQuarters)}, ${JSON.stringify(targetQuarters)});
    renderPreview(r.preview);
    return document.getElementById('preview-grid').textContent;
  `);
}

function pm(win, size) {
  return evalIn(win, `tshirtToPersonMonths(${JSON.stringify(size)})`);
}

// ─── AT-1: a constant-work-only quarter is a Target quarter, never Historical ──
describe('AT-1: a constant-work-only quarter is selectable as a Target quarter but not a Historical quarter', () => {
  it('lists constant-work-only quarters in the Target selector, omits them from the Historical selector, and the Target⊇Historical difference is exactly the constant-work-only quarters', () => {
    const win = loadSimulator();
    // Initiatives + epics span Q2 2026 and Q3 2026.
    loadInitiatives(win, [
      initiativeRow('I-1', 'Platform', 'Q2 2026', 'Backend'),
      initiativeRow('I-2', 'Platform', 'Q3 2026', 'Backend'),
    ]);
    setEpics(win, defaultEpics(['I-1', 'I-2'], 'Q2 2026'));
    // Constant work: two quarters absent from initiatives/epics (Q4 2026, Q1 2027)
    // plus one that overlaps an initiative quarter (Q3 2026) — the overlap must
    // NOT appear in the Target⊇Historical difference (it is not constant-work-only).
    setConstantWork(win, [
      { category: 'Backend', team: 'Platform', quarter: 'Q4 2026', tshirt_size: 'M' },
      { category: 'Backend', team: 'Platform', quarter: 'Q1 2027', tshirt_size: 'L' },
      { category: 'Backend', team: 'Platform', quarter: 'Q3 2026', tshirt_size: 'S' },
    ]);
    refreshQuarters(win);

    const target = selectorOptions(win, 'target-ms');
    const hist   = selectorOptions(win, 'hist-ms');

    // Happy path: the constant-work-only quarter is a selectable Target quarter.
    expect(target).toContain('Q4 2026');
    expect(target).toContain('Q1 2027');
    // Negative: the Historical selector does not list a constant-work-only quarter.
    expect(hist).not.toContain('Q4 2026');
    expect(hist).not.toContain('Q1 2027');

    // Property/invariant: Target options ⊇ Historical options, and the set
    // difference is EXACTLY the constant-work-only quarters (the overlapping
    // Q3 2026 is in both sources, so it is NOT in the difference).
    for (const q of hist) expect(target).toContain(q);
    const diff = target.filter(q => !hist.includes(q)).sort();
    expect(diff).toEqual(['Q1 2027', 'Q4 2026']);
  });
});

// ─── AT-2: a constant-work-only Target quarter → pure-constant-work forecast ──
describe('AT-2: selecting a constant-work-only Target quarter yields a pure-constant-work forecast', () => {
  it('produces kPerGroup all-zero (no Initiatives in the quarter) and sits each Group flat at its own fixedEffortPerGroup entry', () => {
    const win = loadSimulator();
    // The only Initiative lives in the HISTORICAL quarter (Q2 2026); the Target
    // quarter Q4 2026 exists solely in constant work.
    loadInitiatives(win, [initiativeRow('I-1', 'Platform', 'Q2 2026', 'ScaffoldCat')]);
    setEpics(win, defaultEpics(['I-1'], 'Q2 2026'));
    const groups = [
      { name: 'Backend',  color: '#a', members: ['Backend'],  isProjection: true },
      { name: 'Frontend', color: '#b', members: ['Frontend'], isProjection: false },
    ];
    setGroups(win, groups);
    setConstantWork(win, [
      { category: 'Backend',  team: 'Platform', quarter: 'Q4 2026', tshirt_size: 'M' },
      { category: 'Frontend', team: 'Platform', quarter: 'Q4 2026', tshirt_size: 'L' },
    ]);

    const data = evalIn(win, `prepareSimulationData(${JSON.stringify(['Q2 2026'])}, ${JSON.stringify(['Q4 2026'])})`);
    // No Initiatives in the constant-work-only Target quarter.
    expect(data.kPerGroup).toEqual([0, 0]);
    expect(data.fixedEffortPerGroup[0]).toBeCloseTo(pm(win, 'M'), 10);
    expect(data.fixedEffortPerGroup[1]).toBeCloseTo(pm(win, 'L'), 10);

    const out = evalIn(win, `runSimulation({
      lambda: ${data.lambda},
      epicSizingDist: ${JSON.stringify(data.epicSizingDist)},
      kPerGroup: ${JSON.stringify(data.kPerGroup)},
      fixedEffortPerGroup: ${JSON.stringify(data.fixedEffortPerGroup)},
      capacity: 120, iterations: 200,
      groups: ${JSON.stringify(groups)},
    })`);

    const expectBackend  = pm(win, 'M');
    const expectFrontend = pm(win, 'L');
    const back  = out.results[0].sorted;
    const front = out.results[1].sorted;
    // Each Group's distribution is flat at its own shift — no Monte Carlo spread
    // because every Group's K is 0.
    for (let i = 0; i < back.length;  i++) expect(back[i]).toBeCloseTo(expectBackend, 10);
    for (let i = 0; i < front.length; i++) expect(front[i]).toBeCloseTo(expectFrontend, 10);
    expect(out.results[0].stats.p10).toBeCloseTo(expectBackend, 10);
    expect(out.results[0].stats.p90).toBeCloseTo(expectBackend, 10);
    expect(out.results[1].stats.p10).toBeCloseTo(expectFrontend, 10);
    expect(out.results[1].stats.p90).toBeCloseTo(expectFrontend, 10);
  });
});

// ─── AT-3: the Historical selector source is unchanged (initiatives ∪ epics) ──
describe('AT-3: the Historical quarter selector source is unchanged (initiatives ∪ epics)', () => {
  it('lists exactly the initiative ∪ epic quarters in the Historical selector, with no constant-work-only quarter added', () => {
    const win = loadSimulator();
    // Initiatives in Q2 2026 + Q3 2026; one epic tagged Q2 2026.
    loadInitiatives(win, [
      initiativeRow('I-1', 'Platform', 'Q2 2026', 'Backend'),
      initiativeRow('I-2', 'Platform', 'Q3 2026', 'Backend'),
    ]);
    setEpics(win, defaultEpics(['I-1'], 'Q2 2026'));
    // Constant work introduces quarters NOT present in initiatives/epics.
    setConstantWork(win, [
      { category: 'Backend', team: 'Platform', quarter: 'Q4 2026', tshirt_size: 'M' },
      { category: 'Backend', team: 'Platform', quarter: 'Q1 2027', tshirt_size: 'L' },
    ]);
    refreshQuarters(win);

    const hist = selectorOptions(win, 'hist-ms');
    // Exactly the initiative ∪ epic quarters — sorted by year then quarter.
    expect(hist).toEqual(['Q2 2026', 'Q3 2026']);
    // Negative: no constant-work-only quarter leaks into the Historical selector.
    expect(hist).not.toContain('Q4 2026');
    expect(hist).not.toContain('Q1 2027');
  });
});

// ─── AT-4: per-Group constant-work PM beside each per-Group K row ──────────────
describe('AT-4: the Data preview shows per-Group constant-work PM beside each per-Group K row', () => {
  it('reports a group-aligned fixedEffortPerGroup (lifted Group at its PM, other Group at 0) and surfaces the per-Group PM in the rendered preview', () => {
    const win = loadSimulator();
    loadInitiatives(win, [initiativeRow('I-1', 'Platform', 'Q2 2026', 'ScaffoldCat')]);
    setEpics(win, defaultEpics(['I-1'], 'Q2 2026'));
    const groups = [
      { name: 'Backend',  color: '#a', members: ['Backend'],  isProjection: true },
      { name: 'Frontend', color: '#b', members: ['Frontend'], isProjection: false },
    ];
    setGroups(win, groups);
    // Constant work lifts only Backend (group A); Frontend (group B) stays at 0 PM.
    setConstantWork(win, [
      { category: 'Backend', team: 'Platform', quarter: 'Q3 2026', tshirt_size: 'L' },
    ]);

    const preview = previewOf(win, ['Q2 2026'], ['Q3 2026']);

    // Stable seam: the per-Group constant-work PM vector, aligned index-for-index
    // with the per-Group K rows.
    expect(Array.isArray(preview.fixedEffortPerGroup)).toBe(true);
    expect(preview.fixedEffortPerGroup).toHaveLength(preview.kPerGroup.length);
    expect(preview.fixedEffortPerGroup).toHaveLength(preview.groupNames.length);
    // Happy: the matching Group carries its constant-work person-months …
    expect(preview.fixedEffortPerGroup[0]).toBeCloseTo(pm(win, 'L'), 10);
    // … boundary: a Group whose members match no constant work shows 0 PM.
    expect(preview.fixedEffortPerGroup[1]).toBe(0);

    // The rendered preview surfaces the per-Group constant-work PM (exact wording /
    // formatting intentionally NOT locked in per the plan — only its presence).
    const grid = renderedPreviewText(win, ['Q2 2026'], ['Q3 2026']);
    expect(grid).toMatch(/PM/i);
  });
});

// ─── AT-5: an "in no group … excluded" line for constant work in no Group ──────
describe('AT-5: the Data preview shows an in-no-group excluded line for constant work matching no Group', () => {
  it('counts only target-quarter rows whose Category is in no Group toward cwExcludedPM/cwExcludedRows (overlap-aware) and renders an excluded line', () => {
    const win = loadSimulator();
    loadInitiatives(win, [initiativeRow('I-1', 'Platform', 'Q2 2026', 'ScaffoldCat')]);
    setEpics(win, defaultEpics(['I-1'], 'Q2 2026'));
    setGroups(win, [{ name: 'Backend', color: '#a', members: ['Backend'], isProjection: true }]);
    setConstantWork(win, [
      // Excluded: Category 'Ops' is in no Group, and it is in the Target quarter.
      { category: 'Ops',     team: 'Platform', quarter: 'Q3 2026', tshirt_size: 'L' },
      // Overlap-aware negative: 'Backend' IS in a Group → must NOT be counted excluded.
      { category: 'Backend', team: 'Platform', quarter: 'Q3 2026', tshirt_size: 'M' },
      // Boundary: an out-of-Target-quarter 'Ops' row is out of scope → not counted.
      { category: 'Ops',     team: 'Platform', quarter: 'Q4 2026', tshirt_size: 'XL' },
    ]);

    const preview = previewOf(win, ['Q2 2026'], ['Q3 2026']);
    // Only the single in-Target-quarter, in-no-Group row is excluded.
    expect(preview.cwExcludedRows).toBe(1);
    expect(preview.cwExcludedPM).toBeCloseTo(pm(win, 'L'), 10);
    // The in-Group Backend row's effort is NOT folded into the excluded total.
    expect(preview.cwExcludedPM).not.toBeCloseTo(pm(win, 'L') + pm(win, 'M'), 10);

    const grid = renderedPreviewText(win, ['Q2 2026'], ['Q3 2026']);
    expect(grid).toMatch(/excluded/i);
  });
});

// ─── AT-6: no non-zero excluded line when every Category is in a Group ─────────
describe('AT-6: the Data preview shows no non-zero excluded line when all constant work is in a Group', () => {
  it('reports zero excluded PM and rows, and renders no positive "excluded" line', () => {
    const win = loadSimulator();
    loadInitiatives(win, [initiativeRow('I-1', 'Platform', 'Q2 2026', 'ScaffoldCat')]);
    setEpics(win, defaultEpics(['I-1'], 'Q2 2026'));
    setGroups(win, [
      { name: 'Backend',  color: '#a', members: ['Backend'],  isProjection: true },
      { name: 'Frontend', color: '#b', members: ['Frontend'], isProjection: false },
    ]);
    // Every constant-work row's Category is in at least one Group.
    setConstantWork(win, [
      { category: 'Backend',  team: 'Platform', quarter: 'Q3 2026', tshirt_size: 'M' },
      { category: 'Frontend', team: 'Platform', quarter: 'Q3 2026', tshirt_size: 'L' },
    ]);

    const preview = previewOf(win, ['Q2 2026'], ['Q3 2026']);
    // Nothing is excluded (absent or zero are both acceptable per the plan).
    expect(preview.cwExcludedPM || 0).toBe(0);
    expect(preview.cwExcludedRows || 0).toBe(0);

    const grid = renderedPreviewText(win, ['Q2 2026'], ['Q3 2026']);
    // No excluded line reporting a POSITIVE row count (a zero/absent line is fine).
    expect(grid).not.toMatch(/[1-9]\d*\s*rows?\b[\s\S]*excluded/i);
  });
});
