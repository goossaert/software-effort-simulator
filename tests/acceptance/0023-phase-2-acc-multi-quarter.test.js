// Acceptance tests for feature 0023 (Error Report tab), Phase 2 — Multi-quarter
// initiatives (codes 19-22): MQ_FORWARD_DOUBLE_COUNT, MQ_PARTIAL_WINDOW_EXCLUSION,
// MQ_MULTI_QUARTER_HISTORICAL, MQ_INIT_EPIC_QUARTER_MISMATCH. (former Phase 6 —
// AT-1..AT-4. AT-5 full presentation lives in 0023-phase-2-acc-presentation.test.js.)
//
// Seam: prepareSimulationData(histQs, targetQs).findings, computed with the same
// `.trim()` normalisation the engine uses. MQ_FORWARD_DOUBLE_COUNT is reported at
// ERROR (DC-5) but the engine math is unchanged. Vocabulary verbatim from
// CONTEXT.md: Initiative, Initiative key, Epic, Quarter, K, Poisson λ.
//
// RED on the current base: codes 19-22 are unimplemented, so findings carries none.

import { describe, it, expect } from 'vitest';
import { loadSimulator, evalIn, execIn, csv } from '../harness.js';

const H = ['jira_key', 'name', 'category', 'teams', 'quarter'];

function loadInitiatives(win, rows) {
  execIn(win, `loadInitiativesCSV(${JSON.stringify(csv(rows, H))})`);
}
function setEpics(win, epics) {
  execIn(win, `parsedEpics = ${JSON.stringify(epics)};`);
}

// ─── AT-1 (code 19): forward double-count (ERROR — DC-5) ────────────────────
describe('AT-1: an Initiative key in more than one selected target Quarter is reported as MQ_FORWARD_DOUBLE_COUNT (ERROR), engine math unchanged', () => {
  it('reports MQ_FORWARD_DOUBLE_COUNT (ERROR) for the multi-quarter key while leaving the engine outputs intact', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      { jira_key: 'I-1', name: 'Hist', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' },
      { jira_key: 'I-DUP', name: 'Spanning', category: 'Must', teams: 'Team A', quarter: 'Q2 2026' },
      { jira_key: 'I-DUP', name: 'Spanning', category: 'Must', teams: 'Team A', quarter: 'Q3 2026' },
    ]);
    setEpics(win, [
      { _initiative_key: 'I-1', _tshirt_size: 'M', _quarter: 'Q1 2026', _epic_key: 'E1' },
    ]);

    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026','Q3 2026'])");
    expect(Array.isArray(result.findings)).toBe(true);
    // Engine outputs are still computed (advisory finding never alters the Run).
    expect(Array.isArray(result.kPerGroup)).toBe(true);
    expect(typeof result.lambda).toBe('number');

    const flagged = result.findings.filter(f => f.code === 'MQ_FORWARD_DOUBLE_COUNT');
    expect(flagged).toHaveLength(1);
    const f = flagged[0];
    expect(f.severity).toBe('ERROR');
    expect(f.category).toBe('Multi-quarter initiatives');
    expect(f.locators.some(l => l.kind === 'initiative' && l.id === 'I-DUP')).toBe(true);
    // Quantified impact references the target-quarter count (2).
    expect(`${f.message} ${f.impact || ''}`).toMatch(/\b2\b/);
  });
});

// ─── AT-2 (code 20): partial historical-window exclusion (WARNING) ──────────
describe('AT-2: a historical Initiative whose Epics span quarters with some outside the window is reported as MQ_PARTIAL_WINDOW_EXCLUSION (WARNING)', () => {
  it('reports MQ_PARTIAL_WINDOW_EXCLUSION (WARNING) for the Initiative, with the count of excluded Epics', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      { jira_key: 'I-1', name: 'Spanner', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' },
      { jira_key: 'I-2', name: 'Target', category: 'Must', teams: 'Team A', quarter: 'Q2 2026' },
    ]);
    // I-1's Epics: one in the selected window (Q1 2026), one outside it (Q0 2026) —
    // the out-of-window Epic is silently dropped at the in-scope check.
    setEpics(win, [
      { _initiative_key: 'I-1', _tshirt_size: 'M', _quarter: 'Q1 2026', _epic_key: 'E-IN' },
      { _initiative_key: 'I-1', _tshirt_size: 'M', _quarter: 'Q0 2026', _epic_key: 'E-OUT' },
    ]);

    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    const flagged = result.findings.filter(f => f.code === 'MQ_PARTIAL_WINDOW_EXCLUSION');
    expect(flagged).toHaveLength(1);
    const f = flagged[0];
    expect(f.severity).toBe('WARNING');
    expect(f.category).toBe('Multi-quarter initiatives');
    expect(f.locators.some(l => l.kind === 'initiative' && l.id === 'I-1')).toBe(true);
    // Exactly one Epic (E-OUT) was excluded.
    expect(`${f.message} ${f.impact || ''}`).toMatch(/\b1\b/);
  });
});

// ─── AT-3 (code 21): multi-quarter historical initiative (INFO) ─────────────
describe('AT-3: a historical Initiative whose in-window Epics carry more than one distinct Quarter is reported as MQ_MULTI_QUARTER_HISTORICAL (INFO)', () => {
  it('reports MQ_MULTI_QUARTER_HISTORICAL (INFO) for the Initiative spanning two selected historical quarters', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      { jira_key: 'I-1', name: 'Spanner', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' },
      { jira_key: 'I-2', name: 'Target', category: 'Must', teams: 'Team A', quarter: 'Q3 2026' },
    ]);
    // Both Epic quarters (Q1, Q0) are inside the selected historical window.
    setEpics(win, [
      { _initiative_key: 'I-1', _tshirt_size: 'M', _quarter: 'Q1 2026', _epic_key: 'E1' },
      { _initiative_key: 'I-1', _tshirt_size: 'M', _quarter: 'Q0 2026', _epic_key: 'E2' },
    ]);

    const result = evalIn(win, "prepareSimulationData(['Q1 2026','Q0 2026'], ['Q3 2026'])");
    const flagged = result.findings.filter(f => f.code === 'MQ_MULTI_QUARTER_HISTORICAL');
    expect(flagged).toHaveLength(1);
    const f = flagged[0];
    expect(f.severity).toBe('INFO');
    expect(f.category).toBe('Multi-quarter initiatives');
    expect(f.locators.some(l => l.kind === 'initiative' && l.id === 'I-1')).toBe(true);
  });
});

// ─── AT-4 (code 22): initiative/epic quarter mismatch (WARNING) ─────────────
describe('AT-4: an Initiative whose declared Quarter does not match its Epics’ quarters is reported as MQ_INIT_EPIC_QUARTER_MISMATCH (WARNING)', () => {
  it('reports MQ_INIT_EPIC_QUARTER_MISMATCH (WARNING) for the Initiative, referencing the declared vs Epic quarters', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      { jira_key: 'I-1', name: 'Declared Q1', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' },
      { jira_key: 'I-2', name: 'Target', category: 'Must', teams: 'Team A', quarter: 'Q2 2026' },
    ]);
    // I-1 is declared in Q1 2026 but its linked Epic carries Q5 2026.
    setEpics(win, [
      { _initiative_key: 'I-1', _tshirt_size: 'M', _quarter: 'Q5 2026', _epic_key: 'E-MM' },
    ]);

    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    const flagged = result.findings.filter(f => f.code === 'MQ_INIT_EPIC_QUARTER_MISMATCH');
    expect(flagged).toHaveLength(1);
    const f = flagged[0];
    expect(f.severity).toBe('WARNING');
    expect(f.category).toBe('Multi-quarter initiatives');
    expect(f.locators.some(l => l.kind === 'initiative' && l.id === 'I-1')).toBe(true);
    const text = `${f.message} ${f.impact || ''} ${f.locators.map(l => l.id).join(' ')}`;
    expect(text).toContain('Q1 2026'); // declared
    expect(text).toContain('Q5 2026'); // epic quarter
  });
});
