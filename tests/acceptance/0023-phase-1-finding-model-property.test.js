// Inner / property tests for feature 0023 (Error Report tab), Phase 1.
//
// Two generator-based properties from the plan's "Properties / invariants to
// PBT" (docs/plans/0023-error-report-tab.md, Phase 1), plus the example tests
// that triangulate them (happy / boundary / negative) and the Data-quality
// finding contract (I-3 / I-4).
//
// PBT framework: fast-check via @fast-check/vitest `test.prop` (pbt.framework =
// fast-check; pbt.import_symbol matches `test.prop`). Shrinking is left ON (the
// default) so the RED run reports a minimal failing input.
//
// The Recognised t-shirt size set is READ FROM THE LOADED WINDOW
// (Object.keys(T_SHIRT_PARAMS)) — never hand-listed — and the
// recognised/unrecognised oracle is computed through the page's own
// `normalizeSize` + `T_SHIRT_PARAMS`, so the test agrees with what the engine
// actually excludes (I-5, ADR-0037 single source of truth) rather than
// re-implementing size recognition independently.
//
// RED on the unmodified base: prepareSimulationData returns no `findings` field,
// so `result.findings` is `undefined`; the partition assertion and the contract
// examples fail (the additive findings field is unimplemented). The advisory
// I-1 property additionally asserts `findings` is collected before checking the
// engine equality, so it is RED for the same reason.

import { describe, it, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { loadSimulator, read, evalIn, execIn, csv } from '../harness.js';

const H = ['jira_key', 'name', 'category', 'teams', 'quarter'];

// Recognised t-shirt size set, read from a loaded window (NOT hand-listed).
const RECOGNISED = Object.keys(read(loadSimulator(), 'T_SHIRT_PARAMS'));

function loadTwoQuarterInitiatives(win) {
  execIn(win, `loadInitiativesCSV(${JSON.stringify(csv([
    { jira_key: 'I-1', name: 'Hist init', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' },
    { jira_key: 'I-2', name: 'Target init', category: 'Must', teams: 'Team A', quarter: 'Q2 2026' },
  ], H))})`);
}
function setEpics(win, epics) {
  execIn(win, `parsedEpics = ${JSON.stringify(epics)};`);
}
function inScopeEpics(win, sizes) {
  setEpics(win, sizes.map((s, i) => ({
    _initiative_key: 'I-1', _tshirt_size: s, _quarter: 'Q1 2026', _epic_key: `EPIC-${i}`,
  })));
}
// True iff `size` is NOT a Recognised t-shirt size, decided through the page's
// own normalizeSize + T_SHIRT_PARAMS (the engine's recognition test — I-5).
function unrecognisedThroughEngine(win, T, size) {
  const norm = evalIn(win, `normalizeSize(${JSON.stringify(size)})`);
  return !Object.prototype.hasOwnProperty.call(T, norm);
}

// ─── PROPERTY 1: the unrecognised-size partition ────────────────────────────
// ∀ in-scope Epic set, findings.filter(UNRECOGNIZED_SIZE_EPIC) locates EXACTLY
// the Epics whose normalised size ∉ the Recognised t-shirt size set — one each,
// no duplicates. Generator domain spans recognised labels (incl. lowercase /
// trailing-space variants that normalise to recognised — must NOT flag) and
// junk (must flag); count 0…N.
const RECOGNISED_VARIANT = fc.constantFrom(
  ...RECOGNISED,
  ...RECOGNISED.map(s => s.toLowerCase()),
  ...RECOGNISED.map(s => ` ${s} `),
);
const JUNK = fc.constantFrom('XXL', '', '  ', 'medium', 'Large', '🍕', 'XXXXL', 'M.repeat'.repeat(8));
const SIZE_ARB = fc.oneof(RECOGNISED_VARIANT, JUNK, fc.string());

describe('0023 Phase 1 — UNRECOGNIZED_SIZE_EPIC partitions in-scope Epics by Recognised t-shirt size', () => {
  test.prop([fc.array(SIZE_ARB, { maxLength: 12 })], { numRuns: 50 })(
    'flags exactly the in-scope Epics whose normalised size is not a Recognised t-shirt size, one finding each',
    (sizes) => {
      const win = loadSimulator();
      loadTwoQuarterInitiatives(win);
      inScopeEpics(win, sizes);

      const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
      expect(Array.isArray(result.findings)).toBe(true);

      const T = read(win, 'T_SHIRT_PARAMS');
      const expectedKeys = sizes
        .map((s, i) => ({ s, key: `EPIC-${i}` }))
        .filter(({ s }) => unrecognisedThroughEngine(win, T, s))
        .map(({ key }) => key)
        .sort();

      const flagged = result.findings.filter(f => f.code === 'UNRECOGNIZED_SIZE_EPIC');
      const flaggedKeys = flagged.map(f => f.locators.find(l => l.kind === 'epic').id).sort();

      // Exactly the right set …
      expect(flaggedKeys).toEqual(expectedKeys);
      // … and no duplicate findings for the same Epic.
      expect(new Set(flaggedKeys).size).toBe(flaggedKeys.length);
    },
  );

  // Happy path — junk sizes are flagged.
  it('flags an Epic whose size "XXL" is not a Recognised t-shirt size', () => {
    const win = loadSimulator();
    loadTwoQuarterInitiatives(win);
    inScopeEpics(win, ['XXL']);
    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    expect(Array.isArray(result.findings)).toBe(true);
    expect(result.findings.filter(f => f.code === 'UNRECOGNIZED_SIZE_EPIC')).toHaveLength(1);
  });

  // Boundary — empty / whitespace-only sizes are unrecognised and flagged.
  it('flags Epics whose size is empty or whitespace-only', () => {
    const win = loadSimulator();
    loadTwoQuarterInitiatives(win);
    inScopeEpics(win, ['', '   ']);
    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    expect(Array.isArray(result.findings)).toBe(true);
    expect(result.findings.filter(f => f.code === 'UNRECOGNIZED_SIZE_EPIC')).toHaveLength(2);
  });

  // Negative — recognised sizes differing only by case / trailing space must
  // normalise via normalizeSize first and NOT be flagged (counterexample I-5).
  it('does NOT flag recognised sizes that differ only by case or trailing space', () => {
    const win = loadSimulator();
    loadTwoQuarterInitiatives(win);
    inScopeEpics(win, [' m ', 'xl+', '2xs', 'S ']);
    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    expect(Array.isArray(result.findings)).toBe(true);
    expect(result.findings.filter(f => f.code === 'UNRECOGNIZED_SIZE_EPIC')).toHaveLength(0);
  });

  // Boundary — zero Epics produce zero unrecognised-size findings.
  it('produces no UNRECOGNIZED_SIZE_EPIC findings when there are no Epics', () => {
    const win = loadSimulator();
    loadTwoQuarterInitiatives(win);
    setEpics(win, []);
    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    expect(Array.isArray(result.findings)).toBe(true);
    expect(result.findings.filter(f => f.code === 'UNRECOGNIZED_SIZE_EPIC')).toHaveLength(0);
  });
});

// ─── Data-quality finding contract (I-3 / I-4) ──────────────────────────────
describe('0023 Phase 1 — every Data-quality finding obeys the contract shape', () => {
  it('a produced finding carries a valid Severity, a non-empty message, a string code/category, and >= 1 locator with {kind,id}', () => {
    const win = loadSimulator();
    loadTwoQuarterInitiatives(win);
    inScopeEpics(win, ['XXL']);
    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    expect(Array.isArray(result.findings)).toBe(true);
    expect(result.findings.length).toBeGreaterThan(0);
    for (const f of result.findings) {
      expect(['ERROR', 'WARNING', 'INFO']).toContain(f.severity); // I-3
      expect(typeof f.code).toBe('string');
      expect(f.code.length).toBeGreaterThan(0);
      expect(typeof f.category).toBe('string');
      expect(f.category.length).toBeGreaterThan(0);
      expect(typeof f.message).toBe('string');
      expect(f.message.length).toBeGreaterThan(0);
      expect(Array.isArray(f.locators)).toBe(true);
      expect(f.locators.length).toBeGreaterThanOrEqual(1); // I-4
      for (const l of f.locators) {
        expect(typeof l.kind).toBe('string');
        expect(typeof l.id).toBe('string');
      }
    }
  });
});

// ─── PROPERTY 2: collecting findings never alters the Run (advisory — I-1) ──
// ∀ in-scope (recognised-size) Epic set + pinned seed, the engine output
// computed from prepareSimulationData's outputs is byte-identical whether or not
// the findings field is present — runSimulation reads no findings (I-1).
describe('0023 Phase 1 — collecting the Error Report is advisory: the engine output is unaffected by findings (I-1)', () => {
  test.prop([fc.array(fc.constantFrom(...RECOGNISED), { maxLength: 10 })], { numRuns: 25 })(
    'the engine output from prepareSimulationData’s outputs is identical with and without the findings field',
    (recognisedSizes) => {
      const win = loadSimulator();
      execIn(win, 'Date.now = () => 1700000000000;'); // pin the engine seed
      loadTwoQuarterInitiatives(win);
      inScopeEpics(win, recognisedSizes);

      const data = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
      expect(Array.isArray(data.findings)).toBe(true);

      const args = {
        lambda: data.lambda,
        epicSizingDist: data.epicSizingDist,
        kPerGroup: data.kPerGroup,
        groups: read(win, 'groupsStore'),
        capacity: 120,
        iterations: 100,
        fixedEffortPerGroup: data.fixedEffortPerGroup,
      };
      const withFindings = evalIn(win, `runSimulation(${JSON.stringify({ ...args, findings: data.findings })})`);
      const withoutFindings = evalIn(win, `runSimulation(${JSON.stringify(args)})`);

      expect(Array.from(withFindings.results[0].sorted)).toEqual(Array.from(withoutFindings.results[0].sorted));
      expect(withFindings.results[0].stats).toEqual(withoutFindings.results[0].stats);
    },
  );
});
