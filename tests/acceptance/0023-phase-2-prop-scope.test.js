// Property tests for feature 0023 (Error Report tab), Phase 2 — Scope & calibration
// (former Phase 2 "Properties / invariants to PBT"): the ORPHAN/OUT_OF_SCOPE
// partition, and the QUARTER_NO_EPICS iff-condition with its excluded-initiative
// count.
//
// PBT framework: fast-check via @fast-check/vitest `test.prop` (pbt.import_symbol
// matches `test.prop`). Shrinking left ON (default) so a RED run reports a minimal
// counterexample. The oracle mirrors the engine's scope logic exactly (`.trim()`,
// quarter-then-link in-scope test) — it is not re-implemented loosely.
//
// RED on the current base: codes 3-5 are unimplemented, so the flagged sets are
// empty while the oracle expects non-empty for excluded epics / uncovered quarters.

import { describe, it, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
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
function numbersIn(s) {
  return (`${s}`.match(/-?\d+(?:\.\d+)?/g) || []).map(parseFloat);
}

// ─── PROPERTY 1: ORPHAN ∪ EPIC_OUT_OF_SCOPE partition ───────────────────────
// ∀ epic set, the epics flagged ORPHAN_EPIC ∪ EPIC_OUT_OF_SCOPE equal exactly the
// epics the engine drops from λ for a scope reason (the `!inScope || !link`
// continue), partitioned: blank link ⇒ ORPHAN, non-blank-but-out-of-scope ⇒
// EPIC_OUT_OF_SCOPE, never both.
describe('0023 Phase 2 — ORPHAN_EPIC and EPIC_OUT_OF_SCOPE partition the scope-excluded Epics', () => {
  const HIST_KEYS = new Set(['I-1']);          // historical Initiative keys
  const HIST_QSET = new Set(['Q1 2026']);      // selected historical window

  // Engine-faithful classification of one Epic.
  function classify(link, q) {
    const inScope = q ? HIST_QSET.has(q) : HIST_KEYS.has(link);
    if (!link) return 'ORPHAN';                 // blank parent
    if (!inScope) return 'OUT_OF_SCOPE';        // non-blank link, out of scope
    return null;                                // in scope ⇒ neither
  }

  test.prop([
    fc.array(
      fc.record({
        link: fc.constantFrom('', 'I-1', 'I-2', 'GHOST'),
        q: fc.constantFrom('Q1 2026', 'Q2 2026', ''),
      }),
      { maxLength: 12 },
    ),
  ], { numRuns: 40 })(
    'flags exactly the scope-excluded Epics, partitioned by blank vs non-blank Initiative key',
    (items) => {
      const win = loadSimulator();
      loadTwoQuarterInitiatives(win);
      const epics = items.map((it, i) => ({
        _initiative_key: it.link, _tshirt_size: 'M', _quarter: it.q, _epic_key: `E${i}`,
      }));
      setEpics(win, epics);

      const expectedOrphan = new Set();
      const expectedOOS = new Set();
      items.forEach((it, i) => {
        const c = classify(it.link, it.q);
        if (c === 'ORPHAN') expectedOrphan.add(`E${i}`);
        else if (c === 'OUT_OF_SCOPE') expectedOOS.add(`E${i}`);
      });

      const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
      expect(Array.isArray(result.findings)).toBe(true);

      const idsFor = (code) => new Set(
        result.findings
          .filter(f => f.code === code)
          .flatMap(f => f.locators.filter(l => l.kind === 'epic').map(l => l.id)),
      );
      const orphanIds = idsFor('ORPHAN_EPIC');
      const oosIds = idsFor('EPIC_OUT_OF_SCOPE');

      expect([...orphanIds].sort()).toEqual([...expectedOrphan].sort());
      expect([...oosIds].sort()).toEqual([...expectedOOS].sort());
      // Disjoint: no Epic appears under both codes.
      for (const id of orphanIds) expect(oosIds.has(id)).toBe(false);
    },
  );

  // Boundary — zero epics ⇒ no scope findings.
  it('produces no scope findings when there are no Epics', () => {
    const win = loadSimulator();
    loadTwoQuarterInitiatives(win);
    setEpics(win, []);
    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    expect(result.findings.filter(f => f.code === 'ORPHAN_EPIC')).toHaveLength(0);
    expect(result.findings.filter(f => f.code === 'EPIC_OUT_OF_SCOPE')).toHaveLength(0);
  });
});

// ─── PROPERTY 2: QUARTER_NO_EPICS iff a historical quarter has inits but 0 epics ─
describe('0023 Phase 2 — QUARTER_NO_EPICS flags exactly the historical quarters with Initiatives but no in-scope Epics', () => {
  test.prop([
    fc.record({
      q1Inits: fc.nat({ max: 3 }), q1HasEpic: fc.boolean(),
      q0Inits: fc.nat({ max: 3 }), q0HasEpic: fc.boolean(),
    }),
  ], { numRuns: 40 })(
    'emits QUARTER_NO_EPICS iff a selected historical quarter has >= 1 Initiative and 0 tagged Epics, with the right count',
    ({ q1Inits, q1HasEpic, q0Inits, q0HasEpic }) => {
      const win = loadSimulator();
      const rows = [{ jira_key: 'I-T', name: 'target', category: 'Must', teams: 'Team A', quarter: 'Q9 2026' }];
      for (let j = 0; j < q1Inits; j++) rows.push({ jira_key: `Q1-K${j}`, name: 'h1', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' });
      for (let j = 0; j < q0Inits; j++) rows.push({ jira_key: `Q0-K${j}`, name: 'h0', category: 'Must', teams: 'Team A', quarter: 'Q0 2026' });
      loadInitiatives(win, rows);

      const epics = [];
      if (q1HasEpic) epics.push({ _initiative_key: 'I-T', _tshirt_size: 'M', _quarter: 'Q1 2026', _epic_key: 'EP-Q1' });
      if (q0HasEpic) epics.push({ _initiative_key: 'I-T', _tshirt_size: 'M', _quarter: 'Q0 2026', _epic_key: 'EP-Q0' });
      setEpics(win, epics);

      const result = evalIn(win, "prepareSimulationData(['Q1 2026','Q0 2026'], ['Q9 2026'])");
      expect(Array.isArray(result.findings)).toBe(true);

      const expected = new Map(); // quarter → count, only for flagged quarters
      if (q1Inits >= 1 && !q1HasEpic) expected.set('Q1 2026', q1Inits);
      if (q0Inits >= 1 && !q0HasEpic) expected.set('Q0 2026', q0Inits);

      const flagged = result.findings.filter(f => f.code === 'QUARTER_NO_EPICS');
      const flaggedQuarters = new Set(flagged.flatMap(f => f.locators.filter(l => l.kind === 'quarter').map(l => l.id)));
      expect([...flaggedQuarters].sort()).toEqual([...expected.keys()].sort());

      // Each flagged quarter's impact references its excluded-Initiative count.
      for (const f of flagged) {
        const q = f.locators.find(l => l.kind === 'quarter').id;
        const count = expected.get(q);
        expect(numbersIn(`${f.message} ${f.impact || ''}`)).toContain(count);
      }
    },
  );
});
