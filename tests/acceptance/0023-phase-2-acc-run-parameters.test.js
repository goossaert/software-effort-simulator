// Acceptance tests for feature 0023 (Error Report tab), Phase 2 — Run-parameter
// & degenerate-run findings (codes 6-9): LAMBDA_ZERO, TOTAL_K_ZERO,
// CAPACITY_COERCED, ITERATIONS_CLAMPED. (former Phase 3 — AT-1..AT-4.)
//
// Seams: λ=0 / total-K=0 come from prepareSimulationData(...).findings (derived from
// the returned `lambda` / `kPerGroup`); capacity/iterations coercion comes from the
// named pure seam collectRunLevelFindings({ enteredCapacity, usedCapacity,
// enteredIterations, usedIterations }) — the entered-vs-used comparison the run
// handler owns. Vocabulary verbatim from CONTEXT.md: Poisson λ, K, Capacity,
// Iteration, Run, Group, Initiative.
//
// RED on the current base: codes 6-7 are unimplemented (findings carries neither) and
// collectRunLevelFindings does not exist (codes 8-9), so the assertions fail.

import { describe, it, expect } from 'vitest';
import { loadSimulator, evalIn, execIn, csv } from '../harness.js';

const H = ['jira_key', 'name', 'category', 'teams', 'quarter'];

function loadInitiatives(win, rows) {
  execIn(win, `loadInitiativesCSV(${JSON.stringify(csv(rows, H))})`);
}
function setEpics(win, epics) {
  execIn(win, `parsedEpics = ${JSON.stringify(epics)};`);
}
function loadTwoQuarterInitiatives(win) {
  loadInitiatives(win, [
    { jira_key: 'I-1', name: 'Hist init', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' },
    { jira_key: 'I-2', name: 'Target init', category: 'Must', teams: 'Team A', quarter: 'Q2 2026' },
  ]);
}

// ─── AT-1 (code 6): Poisson λ = 0 is reported (WARNING) ─────────────────────
describe('AT-1: a Run whose in-scope historical Initiatives yield Poisson λ = 0 is reported as LAMBDA_ZERO (WARNING)', () => {
  it('reports a LAMBDA_ZERO finding (WARNING) with a run-level locator when lambda === 0', () => {
    const win = loadSimulator();
    loadTwoQuarterInitiatives(win);
    // I-1 is covered by an Epic tagged Q1 2026, but that Epic has an unrecognised
    // size, so I-1 contributes a count of 0 ⇒ Poisson λ = 0.
    setEpics(win, [
      { _initiative_key: 'I-1', _tshirt_size: 'XXL', _quarter: 'Q1 2026', _epic_key: 'EPIC-X' },
    ]);

    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    expect(result.lambda).toBe(0);
    expect(Array.isArray(result.findings)).toBe(true);

    const flagged = result.findings.filter(f => f.code === 'LAMBDA_ZERO');
    expect(flagged).toHaveLength(1);
    const f = flagged[0];
    expect(f.severity).toBe('WARNING');
    expect(f.category).toBe('Run parameters');
    expect(f.locators.some(l => l.kind === 'run')).toBe(true);
  });
});

// ─── AT-2 (code 7): total K = 0 is reported (WARNING) ───────────────────────
describe('AT-2: a Run where no Initiative matches any Group so total K = 0 is reported as TOTAL_K_ZERO (WARNING)', () => {
  it('reports a TOTAL_K_ZERO finding (WARNING) with a run-level locator when sum(kPerGroup) === 0', () => {
    const win = loadSimulator();
    loadTwoQuarterInitiatives(win);
    // A recognised-size historical Epic ⇒ λ > 0, isolating the K = 0 case.
    setEpics(win, [
      { _initiative_key: 'I-1', _tshirt_size: 'M', _quarter: 'Q1 2026', _epic_key: 'EPIC-M' },
    ]);
    // A single Group whose members match NO target Initiative Category ⇒ every
    // kPerGroup entry is 0 ⇒ total K = 0.
    execIn(win, "groupsStore.length = 0; groupsStore.push({ name: 'All', color: '#ccc', members: ['NoSuchCategory'], isProjection: true });");

    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    expect(result.kPerGroup.reduce((a, b) => a + b, 0)).toBe(0);
    expect(Array.isArray(result.findings)).toBe(true);

    const flagged = result.findings.filter(f => f.code === 'TOTAL_K_ZERO');
    expect(flagged).toHaveLength(1);
    const f = flagged[0];
    expect(f.severity).toBe('WARNING');
    expect(f.category).toBe('Run parameters');
    expect(f.locators.some(l => l.kind === 'run')).toBe(true);

    // λ > 0 here, so LAMBDA_ZERO must NOT fire.
    expect(result.findings.filter(f2 => f2.code === 'LAMBDA_ZERO')).toHaveLength(0);
  });
});

// ─── AT-3 (code 8): capacity coercion reported entered-vs-used (WARNING) ────
describe('AT-3: a coerced Capacity is reported as CAPACITY_COERCED (WARNING) stating entered-vs-used', () => {
  it('returns a CAPACITY_COERCED finding when enteredCapacity (0) differs from the used default (120), naming both values', () => {
    const win = loadSimulator();
    // Raw capacity "0" is not a finite number > 0, so the Run used 120:
    //   enteredCapacity = parseFloat("0") = 0 ; usedCapacity = (0 || 120) = 120.
    const findings = evalIn(win, "collectRunLevelFindings({ enteredCapacity: 0, usedCapacity: 120, enteredIterations: 5000, usedIterations: 5000 })");
    expect(Array.isArray(findings)).toBe(true);

    const flagged = findings.filter(f => f.code === 'CAPACITY_COERCED');
    expect(flagged).toHaveLength(1);
    const f = flagged[0];
    expect(f.severity).toBe('WARNING');
    expect(f.category).toBe('Run parameters');
    expect(f.locators.some(l => l.kind === 'run')).toBe(true);
    const text = `${f.message} ${f.impact || ''}`;
    expect(text).toMatch(/\b0\b/);    // the entered value
    expect(text).toMatch(/\b120\b/);  // the used value

    // Iterations were entered === used here ⇒ no ITERATIONS_CLAMPED.
    expect(findings.filter(f2 => f2.code === 'ITERATIONS_CLAMPED')).toHaveLength(0);
  });
});

// ─── AT-4 (code 9): iterations clamp reported entered-vs-used (WARNING) ─────
describe('AT-4: a clamped/defaulted Iterations value is reported as ITERATIONS_CLAMPED (WARNING) stating entered-vs-used', () => {
  it('returns an ITERATIONS_CLAMPED finding when enteredIterations (500) differs from the clamped used value (1000), naming both', () => {
    const win = loadSimulator();
    // Raw iterations "500" is below the [1000, 1e7] floor, so the Run clamped to 1000:
    //   enteredIterations = parseInt("500") = 500 ; usedIterations = max(1000, 500) = 1000.
    const findings = evalIn(win, "collectRunLevelFindings({ enteredCapacity: 120, usedCapacity: 120, enteredIterations: 500, usedIterations: 1000 })");
    expect(Array.isArray(findings)).toBe(true);

    const flagged = findings.filter(f => f.code === 'ITERATIONS_CLAMPED');
    expect(flagged).toHaveLength(1);
    const f = flagged[0];
    expect(f.severity).toBe('WARNING');
    expect(f.category).toBe('Run parameters');
    expect(f.locators.some(l => l.kind === 'run')).toBe(true);
    const text = `${f.message} ${f.impact || ''}`;
    expect(text).toMatch(/\b500\b/);   // the entered value
    expect(text).toMatch(/\b1000\b/);  // the used value
  });

  it('returns NO coercion findings when entered equals used for both Capacity and Iterations', () => {
    const win = loadSimulator();
    const findings = evalIn(win, "collectRunLevelFindings({ enteredCapacity: 120, usedCapacity: 120, enteredIterations: 5000, usedIterations: 5000 })");
    expect(Array.isArray(findings)).toBe(true);
    expect(findings.filter(f => f.code === 'CAPACITY_COERCED')).toHaveLength(0);
    expect(findings.filter(f => f.code === 'ITERATIONS_CLAMPED')).toHaveLength(0);
  });
});
