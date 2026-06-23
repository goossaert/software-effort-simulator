// Acceptance tests for feature 0023 (Error Report tab), Phase 2 — Duplicates &
// overlaps (codes 10-12): DUP_INITIATIVE_KEY, QUARTER_NORM_VARIANT,
// HIST_TARGET_OVERLAP. (former Phase 4 — AT-1/AT-2/AT-3.)
//
// Detectors normalise keys/quarters exactly as the engine does (`.trim()`, no
// lowercase). The jsdom harness's Papa stub trims every CSV cell, so raw
// whitespace variants are installed by overwriting `editedInitiatives` directly
// (after a baseline load establishes `detectedCols`). Vocabulary verbatim from
// CONTEXT.md: Initiative key, Quarter.
//
// RED on the current base: codes 10-12 are unimplemented, so findings carries none.

import { describe, it, expect } from 'vitest';
import { loadSimulator, evalIn, execIn, csv } from '../harness.js';

const H = ['jira_key', 'name', 'category', 'teams', 'quarter'];

// Establish detectedCols via a clean baseline load, then install raw (untrimmed)
// initiative rows directly — bypassing the harness Papa stub's per-cell trim.
function setInitiatives(win, rows) {
  execIn(win, `loadInitiativesCSV(${JSON.stringify(csv([
    { jira_key: 'BASE', name: 'base', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' },
  ], H))})`);
  execIn(win, `editedInitiatives = ${JSON.stringify(rows)};`);
}
function setEpics(win, epics) {
  execIn(win, `parsedEpics = ${JSON.stringify(epics)};`);
}

// ─── AT-1 (code 10): duplicate Initiative key across rows (WARNING) ─────────
describe('AT-1: an Initiative key appearing in more than one Initiatives row is reported as DUP_INITIATIVE_KEY (WARNING)', () => {
  it('reports one DUP_INITIATIVE_KEY finding per duplicated key, with an initiative locator and an impact stating its row count', () => {
    const win = loadSimulator();
    setInitiatives(win, [
      { jira_key: 'DUP-1', name: 'a', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' },
      { jira_key: 'DUP-1', name: 'b', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' },
      { jira_key: 'I-2', name: 'c', category: 'Must', teams: 'Team A', quarter: 'Q2 2026' },
    ]);
    setEpics(win, []);

    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    expect(Array.isArray(result.findings)).toBe(true);

    const flagged = result.findings.filter(f => f.code === 'DUP_INITIATIVE_KEY');
    expect(flagged).toHaveLength(1);
    const f = flagged[0];
    expect(f.severity).toBe('WARNING');
    expect(f.category).toBe('Duplicates & overlaps');
    expect(f.locators.some(l => l.kind === 'initiative' && l.id === 'DUP-1')).toBe(true);
    expect(`${f.impact}`).toMatch(/\b2\b/); // row count

    // The key that appears once is NOT flagged.
    expect(flagged.flatMap(x => x.locators.map(l => l.id))).not.toContain('I-2');
  });
});

// ─── AT-2 (code 11): quarter-label normalisation variants (WARNING) ─────────
describe('AT-2: two Quarter raw strings that collapse to one normalised value but differ raw are reported as QUARTER_NORM_VARIANT (WARNING)', () => {
  it('reports one QUARTER_NORM_VARIANT for the cluster of raw variants, and none for a quarter with a single raw form', () => {
    const win = loadSimulator();
    // "Q2 2026" and " Q2 2026" trim to the same normalised quarter but differ raw;
    // "Q3 2026" has a single raw form (must NOT flag).
    setInitiatives(win, [
      { jira_key: 'I-1', name: 'a', category: 'Must', teams: 'Team A', quarter: 'Q2 2026' },
      { jira_key: 'I-2', name: 'b', category: 'Must', teams: 'Team A', quarter: ' Q2 2026' },
      { jira_key: 'I-3', name: 'c', category: 'Must', teams: 'Team A', quarter: 'Q3 2026' },
    ]);
    setEpics(win, []);

    const result = evalIn(win, "prepareSimulationData(['Q2 2026'], ['Q3 2026'])");
    expect(Array.isArray(result.findings)).toBe(true);

    const flagged = result.findings.filter(f => f.code === 'QUARTER_NORM_VARIANT');
    expect(flagged).toHaveLength(1);
    const f = flagged[0];
    expect(f.severity).toBe('WARNING');
    expect(f.category).toBe('Duplicates & overlaps');
    // The finding references the normalised quarter the variants collapse to.
    const text = `${f.message} ${f.impact || ''} ${f.locators.map(l => l.id).join(' ')}`;
    expect(text).toContain('Q2 2026');
  });
});

// ─── AT-3 (code 12): historical ∩ target Quarter overlap (WARNING) ──────────
describe('AT-3: a normalised Quarter selected in both the historical and target window is reported as HIST_TARGET_OVERLAP (WARNING)', () => {
  it('reports a HIST_TARGET_OVERLAP finding naming the overlapping Quarter', () => {
    const win = loadSimulator();
    setInitiatives(win, [
      { jira_key: 'I-1', name: 'a', category: 'Must', teams: 'Team A', quarter: 'Q2 2026' },
    ]);
    setEpics(win, []);

    // Q2 2026 is selected in BOTH windows.
    const result = evalIn(win, "prepareSimulationData(['Q2 2026'], ['Q2 2026'])");
    expect(Array.isArray(result.findings)).toBe(true);

    const flagged = result.findings.filter(f => f.code === 'HIST_TARGET_OVERLAP');
    expect(flagged.length).toBeGreaterThanOrEqual(1);
    const f = flagged[0];
    expect(f.severity).toBe('WARNING');
    expect(f.category).toBe('Duplicates & overlaps');
    const ids = flagged.flatMap(x => x.locators.map(l => (l.id || '').trim()));
    expect(ids).toContain('Q2 2026');
  });
});
