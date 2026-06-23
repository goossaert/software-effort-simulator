// Acceptance tests for feature 0023 (Error Report tab), Phase 2 — Scope &
// calibration exclusions (codes 3-5): EPIC_OUT_OF_SCOPE, ORPHAN_EPIC,
// QUARTER_NO_EPICS. (former Phase 2 — AT-1/AT-2/AT-3.)
//
// Tests target ONLY the named seam prepareSimulationData(histQs, targetQs).findings
// (the additive Data-quality finding array) and the rendered #tab-error-report DOM —
// never private detector helper names. Vocabulary is verbatim from CONTEXT.md:
// Epic, Initiative, Initiative key, Quarter, Poisson λ, Run, Data-quality finding,
// Severity.
//
// RED on the current base (commit 79dcd45..HEAD): codes 3-5 are unimplemented, so
// prepareSimulationData(...).findings carries none of them and the assertions fail.

import { describe, it, expect } from 'vitest';
import { loadSimulator, evalIn, execIn, csv } from '../harness.js';

const H = ['jira_key', 'name', 'category', 'teams', 'quarter'];

function loadInitiatives(win, rows) {
  execIn(win, `loadInitiativesCSV(${JSON.stringify(csv(rows, H))})`);
}
function setEpics(win, epics) {
  execIn(win, `parsedEpics = ${JSON.stringify(epics)};`);
}

// One historical Initiative (I-1, Q1 2026) and one target Initiative (I-2, Q2 2026).
function loadTwoQuarterInitiatives(win) {
  loadInitiatives(win, [
    { jira_key: 'I-1', name: 'Hist init', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' },
    { jira_key: 'I-2', name: 'Target init', category: 'Must', teams: 'Team A', quarter: 'Q2 2026' },
  ]);
}

// ─── AT-1 (code 3): an out-of-scope Epic is reported as EPIC_OUT_OF_SCOPE (INFO) ─
describe('AT-1: an Epic excluded from Poisson λ with a non-blank Initiative key is reported as EPIC_OUT_OF_SCOPE (INFO)', () => {
  it('reports one EPIC_OUT_OF_SCOPE finding (INFO) locating an in-link Epic whose Initiative is not in the historical window', () => {
    const win = loadSimulator();
    loadTwoQuarterInitiatives(win);
    // Epic links to I-2 — a real Initiative key, but I-2 is a target (not historical)
    // Initiative, so the Epic is out of scope for λ. Non-blank link ⇒ not an orphan;
    // I-2 exists ⇒ not a dangling link.
    setEpics(win, [
      { _initiative_key: 'I-2', _tshirt_size: 'M', _quarter: '', _epic_key: 'EPIC-OOS' },
    ]);

    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    expect(Array.isArray(result.findings)).toBe(true);

    const flagged = result.findings.filter(f => f.code === 'EPIC_OUT_OF_SCOPE');
    expect(flagged).toHaveLength(1);
    const f = flagged[0];
    expect(f.severity).toBe('INFO');
    expect(f.category).toBe('Scope & calibration');
    expect(f.locators.some(l => l.kind === 'epic' && l.id === 'EPIC-OOS')).toBe(true);
    expect(typeof f.message).toBe('string');
    expect(f.message.length).toBeGreaterThan(0);

    // The out-of-scope Epic must NOT also be reported as an orphan (disjoint — I-2).
    const orphans = result.findings.filter(f2 => f2.code === 'ORPHAN_EPIC');
    expect(orphans.flatMap(o => o.locators.map(l => l.id))).not.toContain('EPIC-OOS');
  });
});

// ─── AT-2 (code 4): an orphan Epic (blank parent) is its own category (WARNING) ─
describe('AT-2: an Epic whose Initiative key is blank is reported as ORPHAN_EPIC (WARNING), distinct from EPIC_OUT_OF_SCOPE', () => {
  it('reports one ORPHAN_EPIC finding (WARNING) and does not also report the same Epic as EPIC_OUT_OF_SCOPE', () => {
    const win = loadSimulator();
    loadTwoQuarterInitiatives(win);
    // Blank _initiative_key: an empty parent. _quarter matches the historical
    // window, so it is "in scope by quarter", but the blank link still drops it
    // from λ — that drop is reported as ORPHAN_EPIC, never EPIC_OUT_OF_SCOPE.
    setEpics(win, [
      { _initiative_key: '', _tshirt_size: 'M', _quarter: 'Q1 2026', _epic_key: 'EPIC-ORPH' },
    ]);

    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    expect(Array.isArray(result.findings)).toBe(true);

    const orphans = result.findings.filter(f => f.code === 'ORPHAN_EPIC');
    expect(orphans).toHaveLength(1);
    const f = orphans[0];
    expect(f.severity).toBe('WARNING');
    expect(f.category).toBe('Scope & calibration');
    expect(f.locators.some(l => l.kind === 'epic' && l.id === 'EPIC-ORPH')).toBe(true);

    // Disjoint categories — the orphan is NOT also an EPIC_OUT_OF_SCOPE (I-2).
    const oos = result.findings.filter(f2 => f2.code === 'EPIC_OUT_OF_SCOPE');
    expect(oos.flatMap(o => o.locators.map(l => l.id))).not.toContain('EPIC-ORPH');
  });
});

// ─── AT-3 (code 5): a historical Quarter with Initiatives but no in-scope Epics ─
describe('AT-3: a selected historical Quarter with Initiatives but zero in-scope Epics is reported as QUARTER_NO_EPICS (WARNING)', () => {
  it('reports QUARTER_NO_EPICS (WARNING) with a quarter locator and an impact stating the count of its excluded Initiatives', () => {
    const win = loadSimulator();
    // Two historical quarters. Q1 2026 has an Initiative AND a tagged Epic;
    // Q0 2026 has an Initiative but NO loaded Epic — so its Initiatives drop out
    // of the λ denominator (the quartersWithEpicData filter).
    loadInitiatives(win, [
      { jira_key: 'I-1', name: 'Covered', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' },
      { jira_key: 'I-0', name: 'Uncovered', category: 'Must', teams: 'Team A', quarter: 'Q0 2026' },
      { jira_key: 'I-2', name: 'Target', category: 'Must', teams: 'Team A', quarter: 'Q2 2026' },
    ]);
    setEpics(win, [
      { _initiative_key: 'I-1', _tshirt_size: 'M', _quarter: 'Q1 2026', _epic_key: 'EPIC-1' },
    ]);

    const result = evalIn(win, "prepareSimulationData(['Q1 2026','Q0 2026'], ['Q2 2026'])");
    expect(Array.isArray(result.findings)).toBe(true);

    const flagged = result.findings.filter(f => f.code === 'QUARTER_NO_EPICS');
    expect(flagged).toHaveLength(1);
    const f = flagged[0];
    expect(f.severity).toBe('WARNING');
    expect(f.category).toBe('Scope & calibration');
    expect(f.locators.some(l => l.kind === 'quarter' && l.id === 'Q0 2026')).toBe(true);
    // Impact states the count of excluded Initiatives (Q0 2026 has exactly 1).
    expect(`${f.impact}`).toMatch(/\b1\b/);

    // The covered historical quarter (Q1 2026) must NOT be flagged.
    expect(flagged.flatMap(x => x.locators.map(l => l.id))).not.toContain('Q1 2026');
  });
});
