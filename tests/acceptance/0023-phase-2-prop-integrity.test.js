// Property tests for feature 0023 (Error Report tab), Phase 2 — initiative & cross-
// reference integrity + constant-work exclusion (former Phase 5 "Properties /
// invariants to PBT"): the DANGLING_EPIC_LINK vs ORPHAN_EPIC partition, and the
// CONSTANT_WORK_EXCLUDED single-source PM/rows equality with getConstantWorkExcluded.
//
// PBT framework: fast-check via @fast-check/vitest `test.prop`; shrinking ON.
// RED on the current base: codes 16 & 18 are unimplemented, so the flagged sets are
// empty / the excluded finding is absent while the oracle expects them.

import { describe, it, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { loadSimulator, evalIn, execIn, csv } from '../harness.js';

const H = ['jira_key', 'name', 'category', 'teams', 'quarter'];

function loadTwoQuarterInitiatives(win) {
  execIn(win, `loadInitiativesCSV(${JSON.stringify(csv([
    { jira_key: 'I-1', name: 'Hist init', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' },
    { jira_key: 'I-2', name: 'Target init', category: 'Must', teams: 'Team A', quarter: 'Q2 2026' },
  ], H))})`);
}
function setEpics(win, epics) {
  execIn(win, `parsedEpics = ${JSON.stringify(epics)};`);
}
function setConstantWork(win, rows) {
  execIn(win, `editedConstantWork = ${JSON.stringify(rows)};`);
}
function numbersIn(s) {
  return (`${s}`.match(/-?\d+(?:\.\d+)?/g) || []).map(parseFloat);
}

// ─── PROPERTY 1: DANGLING_EPIC_LINK vs ORPHAN_EPIC partition ────────────────
// Initiative key set = {I-1, I-2}. An Epic is flagged DANGLING_EPIC_LINK iff its
// link is non-blank and not in that set, ORPHAN_EPIC iff blank — never both, and
// every blank/unknown-link Epic is flagged.
describe('0023 Phase 2 — DANGLING_EPIC_LINK and ORPHAN_EPIC partition Epics by blank vs unknown non-blank Initiative key', () => {
  const KEYSET = new Set(['I-1', 'I-2']);

  test.prop([
    fc.array(fc.constantFrom('', 'I-1', 'I-2', 'GHOST-0', 'GHOST-1'), { maxLength: 12 }),
  ], { numRuns: 40 })(
    'flags blank-link Epics as ORPHAN_EPIC and unknown-non-blank-link Epics as DANGLING_EPIC_LINK, disjointly',
    (links) => {
      const win = loadSimulator();
      loadTwoQuarterInitiatives(win);
      // All Epics carry an in-window quarter + recognised size, so scope is not the
      // discriminator here — only the Initiative key membership is.
      const epics = links.map((link, i) => ({ _initiative_key: link, _tshirt_size: 'M', _quarter: 'Q1 2026', _epic_key: `E${i}` }));
      setEpics(win, epics);

      const expectedOrphan = new Set();
      const expectedDangling = new Set();
      links.forEach((link, i) => {
        if (!link) expectedOrphan.add(`E${i}`);
        else if (!KEYSET.has(link)) expectedDangling.add(`E${i}`);
      });

      const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
      expect(Array.isArray(result.findings)).toBe(true);

      const idsFor = (code) => new Set(
        result.findings.filter(f => f.code === code).flatMap(f => f.locators.filter(l => l.kind === 'epic').map(l => l.id)),
      );
      const orphanIds = idsFor('ORPHAN_EPIC');
      const danglingIds = idsFor('DANGLING_EPIC_LINK');

      expect([...orphanIds].sort()).toEqual([...expectedOrphan].sort());
      expect([...danglingIds].sort()).toEqual([...expectedDangling].sort());
      for (const id of danglingIds) expect(orphanIds.has(id)).toBe(false);
    },
  );
});

// ─── PROPERTY 2: CONSTANT_WORK_EXCLUDED is single-sourced from getConstantWorkExcluded ─
describe('0023 Phase 2 — CONSTANT_WORK_EXCLUDED reports exactly getConstantWorkExcluded(...) PM and rows for the target quarters', () => {
  test.prop([
    fc.array(
      fc.record({
        cat: fc.constantFrom('Must', 'Locked', 'Other'),
        q: fc.constantFrom('Q2 2026', 'Q3 2026'),
        size: fc.constantFrom('M', 'XL', 'XXL'),
      }),
      { maxLength: 8 },
    ),
  ], { numRuns: 40 })(
    'emits CONSTANT_WORK_EXCLUDED iff getConstantWorkExcluded reports rows > 0, with matching PM and row count',
    (items) => {
      const win = loadSimulator();
      loadTwoQuarterInitiatives(win);
      setEpics(win, [{ _initiative_key: 'I-1', _tshirt_size: 'M', _quarter: 'Q1 2026', _epic_key: 'E1' }]);
      // Single Group "All" with members {Must}: categories Locked/Other are in no Group.
      execIn(win, "groupsStore.length = 0; groupsStore.push({ name: 'All', color: '#ccc', members: ['Must'], isProjection: true });");
      const cwRows = items.map((it, i) => ({ jira_key: `CW${i}`, epic_name: `cw${i}`, category: it.cat, team: 'Team A', quarter: it.q, tshirt_size: it.size }));
      setConstantWork(win, cwRows);

      const excluded = evalIn(win, "getConstantWorkExcluded(['Q2 2026'], groupsStore)");
      const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
      expect(Array.isArray(result.findings)).toBe(true);

      const flagged = result.findings.filter(f => f.code === 'CONSTANT_WORK_EXCLUDED');
      expect(flagged.length === 1).toBe(excluded.rows > 0);
      if (excluded.rows > 0) {
        const f = flagged[0];
        expect(f.severity).toBe('WARNING');
        expect(f.category).toBe('Constant work');
        const nums = numbersIn(`${f.message} ${f.impact || ''}`);
        expect(nums).toContain(excluded.rows); // single source — row count
        expect(nums).toContain(excluded.pm);   // single source — PM total (no re-rounding)
      }
    },
  );
});
