// Acceptance tests for feature 0023 (Error Report tab), Phase 1: the tracer
// bullet — the Error Report Tab + Tab panel (DC-1), the additive
// `prepareSimulationData(...).findings` Data-quality finding model (DC-2), the
// `renderErrorReport(findings)` panel renderer + empty state, and the
// unrecognised-t-shirt-size findings (AC-1/AC-2/AC-3) plus the advisory engine
// invariant (AC-13 / I-1).
//
// Each `it`/`describe` maps to one scenario in
// docs/plans/0023-error-report-tab.md, Phase 1 "Acceptance behavior" (AT-1…AT-5).
//
// Tests target ONLY the named seams the plan pins:
//   • prepareSimulationData(histQs, targetQs).findings  (additive field)
//   • renderErrorReport(findings)                       (paints #tab-error-report)
//   • the rendered jsdom DOM (#tab-error-report, .tab-btn[data-tab="error-report"])
// They do NOT target private detector helper names nor a fixed per-finding DOM
// tree — assertions are on finding-level fields and panel text content, so
// Phase 6's sectioning cannot break these frozen Phase-1 tests.
//
// Vocabulary is verbatim from CONTEXT.md: Error Report, Data-quality finding,
// Severity, Recognised t-shirt size, Constant work, Bootstrap pool, Poisson λ,
// Tab, Tab panel, Run.

import { describe, it, expect } from 'vitest';
import { loadSimulator, read, evalIn, execIn, csv } from '../harness.js';

const H = ['jira_key', 'name', 'category', 'teams', 'quarter'];

function loadInitiatives(win, rows) {
  execIn(win, `loadInitiativesCSV(${JSON.stringify(csv(rows, H))})`);
}
function setEpics(win, epics) {
  execIn(win, `parsedEpics = ${JSON.stringify(epics)};`);
}
function setConstantWork(win, rows) {
  execIn(win, `editedConstantWork = ${JSON.stringify(rows)};`);
}

// A minimal, clean two-quarter setup: one historical Initiative (Q1 2026) and
// one target Initiative (Q2 2026), so prepareSimulationData runs end-to-end.
function loadTwoQuarterInitiatives(win) {
  loadInitiatives(win, [
    { jira_key: 'I-1', name: 'Hist init', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' },
    { jira_key: 'I-2', name: 'Target init', category: 'Must', teams: 'Team A', quarter: 'Q2 2026' },
  ]);
}

// ─── AT-1: the Error Report Tab exists, last, and org stays the resting tab ──
describe('AT-1: the Error Report Tab is present, last in the tab bar, and org is the resting Tab', () => {
  it('renders a .tab-btn[data-tab="error-report"] labelled "Error Report" as the LAST tab in .tab-bar', () => {
    const win = loadSimulator();
    const btns = win.document.querySelectorAll('.tab-bar .tab-btn');
    expect(btns.length).toBeGreaterThan(0);
    const last = btns[btns.length - 1];
    expect(last.dataset.tab).toBe('error-report');
    expect(last.textContent.trim()).toBe('Error Report');
  });

  it('renders a #tab-error-report Tab panel that is display:none while the org Tab stays active', () => {
    const win = loadSimulator();
    const panel = win.document.getElementById('tab-error-report');
    expect(panel).not.toBeNull();
    expect(panel.classList.contains('tab-panel')).toBe(true);
    expect(panel.style.display).toBe('none');

    const orgBtn = win.document.querySelector('.tab-btn[data-tab="org"]');
    expect(orgBtn.classList.contains('active')).toBe(true);
    const errBtn = win.document.querySelector('.tab-btn[data-tab="error-report"]');
    expect(errBtn.classList.contains('active')).toBe(false);
  });
});

// ─── AT-2: empty state when the data is clean ───────────────────────────────
describe('AT-2: the Error Report shows an explicit empty state when there are no Data-quality findings', () => {
  it('renderErrorReport([]) paints #tab-error-report with the literal text "No data issues detected." and zero finding entries', () => {
    const win = loadSimulator();
    execIn(win, 'renderErrorReport([])');
    const panel = win.document.getElementById('tab-error-report');
    expect(panel).not.toBeNull();
    expect(panel.textContent).toContain('No data issues detected.');
  });
});

// ─── AT-3: an Epic with an unrecognised t-shirt size is listed (ERROR) ──────
describe('AT-3: an in-scope Epic whose size is not a Recognised t-shirt size is reported as UNRECOGNIZED_SIZE_EPIC (ERROR)', () => {
  it('collects exactly one UNRECOGNIZED_SIZE_EPIC finding locating the offending Epic and notes exclusion from Poisson λ and the Bootstrap pool', () => {
    const win = loadSimulator();
    loadTwoQuarterInitiatives(win);
    setEpics(win, [
      { _initiative_key: 'I-1', _tshirt_size: 'XXL', _quarter: 'Q1 2026', _epic_key: 'EPIC-XXL' },
      // recognised-size sibling — the negative case: it must NOT be flagged.
      { _initiative_key: 'I-1', _tshirt_size: 'M', _quarter: 'Q1 2026', _epic_key: 'EPIC-M' },
    ]);

    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    expect(Array.isArray(result.findings)).toBe(true);

    const flagged = result.findings.filter(f => f.code === 'UNRECOGNIZED_SIZE_EPIC');
    expect(flagged).toHaveLength(1);
    const f = flagged[0];
    expect(f.severity).toBe('ERROR');
    expect(Array.isArray(f.locators)).toBe(true);
    expect(f.locators.some(l => l.kind === 'epic' && l.id === 'EPIC-XXL')).toBe(true);
    expect(typeof f.message).toBe('string');
    expect(f.message.length).toBeGreaterThan(0);
    const text = `${f.message} ${f.impact || ''}`;
    expect(text).toMatch(/bootstrap pool/i);
    expect(text).toMatch(/λ|lambda|poisson/i);

    // The recognised-size sibling must not appear under this code at all.
    const flaggedIds = flagged.flatMap(x => x.locators.map(l => l.id));
    expect(flaggedIds).not.toContain('EPIC-M');

    // The rendered Error Report panel shows the offending Epic key.
    execIn(win, "renderErrorReport(prepareSimulationData(['Q1 2026'], ['Q2 2026']).findings)");
    const panel = win.document.getElementById('tab-error-report');
    expect(panel).not.toBeNull();
    expect(panel.textContent).toContain('EPIC-XXL');
  });
});

// ─── AT-4: a Constant work row with an unrecognised size is listed (WARNING) ─
describe('AT-4: a target-quarter Constant work row whose size is not a Recognised t-shirt size is reported as UNRECOGNIZED_SIZE_CONSTANT_WORK (WARNING)', () => {
  it('collects exactly one UNRECOGNIZED_SIZE_CONSTANT_WORK finding with a row locator and a message noting it contributed 0 PM', () => {
    const win = loadSimulator();
    loadTwoQuarterInitiatives(win);
    setEpics(win, []); // no epic-side findings — isolate the Constant work case
    setConstantWork(win, [
      { jira_key: 'CW-1', epic_name: 'Locked work', category: 'Must', team: 'Team A', quarter: 'Q2 2026', tshirt_size: 'XXL' },
    ]);

    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    expect(Array.isArray(result.findings)).toBe(true);

    const flagged = result.findings.filter(f => f.code === 'UNRECOGNIZED_SIZE_CONSTANT_WORK');
    expect(flagged).toHaveLength(1);
    const f = flagged[0];
    expect(f.severity).toBe('WARNING');
    expect(Array.isArray(f.locators)).toBe(true);
    expect(f.locators.some(l => l.kind === 'row')).toBe(true);
    const text = `${f.message} ${f.impact || ''}`;
    expect(text).toMatch(/\b0\b/);
    expect(text).toMatch(/pm|person-month/i);
  });
});

// ─── AT-5: collecting the report never alters the Run (advisory — AC-13/I-1) ─
describe('AT-5: collecting the Error Report never alters the Run — runSimulation reads no findings (advisory, I-1)', () => {
  it('returns findings additively while the engine output depends only on its declared arguments (a findings field is ignored)', () => {
    const win = loadSimulator();
    // runSimulation re-seeds the PRNG from Date.now() internally; freeze it so
    // two Runs are byte-identical and the equality below is deterministic.
    execIn(win, 'Date.now = () => 1700000000000;');
    loadTwoQuarterInitiatives(win);
    setEpics(win, [
      { _initiative_key: 'I-1', _tshirt_size: 'M', _quarter: 'Q1 2026', _epic_key: 'EPIC-M' },
    ]);

    const data = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    // Advisory contract: findings are collected as an array (additive field).
    expect(Array.isArray(data.findings)).toBe(true);

    const args = {
      lambda: data.lambda,
      epicSizingDist: data.epicSizingDist,
      kPerGroup: data.kPerGroup,
      groups: read(win, 'groupsStore'),
      capacity: 120,
      iterations: 200,
      fixedEffortPerGroup: data.fixedEffortPerGroup,
    };
    const withFindings = evalIn(win, `runSimulation(${JSON.stringify({ ...args, findings: [{ code: 'IGNORED_BY_ENGINE' }] })})`);
    const withoutFindings = evalIn(win, `runSimulation(${JSON.stringify(args)})`);

    // The sorted per-Scenario distribution and Stats are identical with/without
    // the findings field — runSimulation takes no findings argument and reads none.
    expect(Array.from(withFindings.results[0].sorted)).toEqual(Array.from(withoutFindings.results[0].sorted));
    expect(withFindings.results[0].stats).toEqual(withoutFindings.results[0].stats);
    // The engine result object never carries a findings field.
    expect(withFindings.findings).toBeUndefined();
  });
});
