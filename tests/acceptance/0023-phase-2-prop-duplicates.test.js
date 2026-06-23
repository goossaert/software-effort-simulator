// Property tests for feature 0023 (Error Report tab), Phase 2 — duplicates &
// overlaps (former Phase 4 "Properties / invariants to PBT"): DUP_INITIATIVE_KEY
// equals exactly the keys whose normalised form occurs >= 2 times (each with the
// right count); HIST_TARGET_OVERLAP lists exactly normalise(hist) ∩ normalise(target).
//
// Engine normalisation is `.trim()` only (no lowercase), so only whitespace variants
// collapse. The harness Papa stub trims cells, so raw whitespace variants are
// installed by overwriting `editedInitiatives` directly (DUP property); the overlap
// property passes raw quarter arrays straight to prepareSimulationData's args.
//
// PBT framework: fast-check via @fast-check/vitest `test.prop`; shrinking ON.
// RED on the current base: codes 10 & 12 are unimplemented, so the flagged sets are
// empty while the oracle expects non-empty for duplicated keys / overlapping quarters.

import { describe, it, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { loadSimulator, evalIn, execIn, csv } from '../harness.js';

const H = ['jira_key', 'name', 'category', 'teams', 'quarter'];

function baselineLoad(win) {
  execIn(win, `loadInitiativesCSV(${JSON.stringify(csv([
    { jira_key: 'BASE', name: 'base', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' },
  ], H))})`);
}
function setEpics(win, epics) {
  execIn(win, `parsedEpics = ${JSON.stringify(epics)};`);
}
function numbersIn(s) {
  return (`${s}`.match(/-?\d+(?:\.\d+)?/g) || []).map(parseFloat);
}

// ─── PROPERTY 1: DUP_INITIATIVE_KEY = keys with trimmed multiplicity >= 2 ────
describe('0023 Phase 2 — DUP_INITIATIVE_KEY flags exactly the Initiative keys whose normalised form occurs >= 2 times', () => {
  test.prop([
    fc.array(fc.constantFrom('A', ' A ', 'A ', ' B', 'B', 'C', ' C '), { maxLength: 12 }),
  ], { numRuns: 40 })(
    'flags exactly the trimmed keys occurring >= 2 times, each with its correct row count, and none occurring once',
    (rawKeys) => {
      const win = loadSimulator();
      baselineLoad(win);
      const rows = rawKeys.map((k, i) => ({ jira_key: k, name: `n${i}`, category: 'Must', teams: 'Team A', quarter: 'Q1 2026' }));
      execIn(win, `editedInitiatives = ${JSON.stringify(rows)};`);
      setEpics(win, []);

      const counts = new Map();
      for (const k of rawKeys) {
        const t = k.trim();
        counts.set(t, (counts.get(t) || 0) + 1);
      }
      const expectedDup = new Map([...counts].filter(([, c]) => c >= 2));

      const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
      expect(Array.isArray(result.findings)).toBe(true);

      const flagged = result.findings.filter(f => f.code === 'DUP_INITIATIVE_KEY');
      const flaggedKeys = new Set(flagged.flatMap(f => f.locators.filter(l => l.kind === 'initiative').map(l => (l.id || '').trim())));
      expect([...flaggedKeys].sort()).toEqual([...expectedDup.keys()].sort());

      // Each flagged key's impact references its row count.
      for (const f of flagged) {
        const key = (f.locators.find(l => l.kind === 'initiative').id || '').trim();
        expect(numbersIn(`${f.message} ${f.impact || ''}`)).toContain(expectedDup.get(key));
      }
    },
  );
});

// ─── PROPERTY 2: HIST_TARGET_OVERLAP = normalise(hist) ∩ normalise(target) ──
describe('0023 Phase 2 — HIST_TARGET_OVERLAP lists exactly the quarters in the trimmed historical∩target intersection', () => {
  const Q = fc.constantFrom('Q1 2026', ' Q1 2026', 'Q2 2026', 'Q2 2026 ', 'Q3 2026', ' Q3 2026 ');

  test.prop([fc.array(Q, { maxLength: 4 }), fc.array(Q, { maxLength: 4 })], { numRuns: 50 })(
    'flags exactly the normalised quarters selected in both windows (whitespace variants collapse)',
    (hist, target) => {
      const win = loadSimulator();
      execIn(win, `loadInitiativesCSV(${JSON.stringify(csv([
        { jira_key: 'I-1', name: 'a', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' },
      ], H))})`);
      setEpics(win, []);

      const histSet = new Set(hist.map(s => s.trim()));
      const overlap = new Set([...new Set(target.map(s => s.trim()))].filter(q => histSet.has(q)));

      const result = evalIn(win, `prepareSimulationData(${JSON.stringify(hist)}, ${JSON.stringify(target)})`);
      expect(Array.isArray(result.findings)).toBe(true);

      const flagged = result.findings.filter(f => f.code === 'HIST_TARGET_OVERLAP');
      const flaggedQ = new Set(flagged.flatMap(f => f.locators.filter(l => l.kind === 'quarter').map(l => (l.id || '').trim())));
      expect([...flaggedQ].sort()).toEqual([...overlap].sort());
    },
  );
});
