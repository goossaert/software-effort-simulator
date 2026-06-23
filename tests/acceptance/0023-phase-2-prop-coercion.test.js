// Property tests for feature 0023 (Error Report tab), Phase 2 — run-parameter
// coercion (former Phase 3 "Properties / invariants to PBT"): CAPACITY_COERCED and
// ITERATIONS_CLAMPED are present iff the value the Run used differs from the entered
// value, per the run handler's exact coerce/clamp formulas.
//
// The seam collectRunLevelFindings({ enteredCapacity, usedCapacity,
// enteredIterations, usedIterations }) receives the already-computed entered/used
// pair (it must NOT re-read #capacity/#iterations — single source, ADR-0037), so the
// property computes entered/used from the raw string with the SAME formulas the run
// handler uses:
//   capacity:    entered = parseFloat(raw)        ; used = parseFloat(raw) || 120
//   iterations:  entered = parseInt(raw, 10)      ; used = min(1e7, max(1000, parseInt(raw,10) || 1e6))
//
// PBT framework: fast-check via @fast-check/vitest `test.prop`; shrinking ON.
// RED on the current base: collectRunLevelFindings does not exist (codes 8-9), so
// evalIn returns undefined and the presence assertions fail.

import { describe, it, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { loadSimulator, evalIn } from '../harness.js';

const capacityUsed = (raw) => (parseFloat(raw) || 120);
const iterationsUsed = (raw) => Math.min(10000000, Math.max(1000, parseInt(raw, 10) || 1000000));

// Raw capacity strings spanning valid numbers and the adversarial edges.
const RAW_CAPACITY = fc.oneof(
  fc.constantFrom('0', '-5', '-0.5', '', 'abc', 'NaN', '1e9', '  ', '120', '100.5', '0.001', '999999', '60'),
  fc.integer({ min: -10, max: 1000 }).map(String),
  fc.float({ min: Math.fround(-100), max: Math.fround(1000), noNaN: true }).map(String),
);
// Raw iterations strings spanning in-range, below floor, above ceiling, junk.
const RAW_ITERATIONS = fc.oneof(
  fc.constantFrom('500', '1500', '5000', '20000000', '15000000', '3.7', '', 'abc', '999', '1000', '10000000', '10000001'),
  fc.integer({ min: -100, max: 12000000 }).map(String),
);

// ─── PROPERTY 1: CAPACITY_COERCED ⇔ used !== entered ────────────────────────
describe('0023 Phase 2 — CAPACITY_COERCED is present iff the used Capacity differs from the entered value', () => {
  test.prop([RAW_CAPACITY], { numRuns: 60 })(
    'reports CAPACITY_COERCED iff (parseFloat(raw) || 120) !== parseFloat(raw), naming the used value',
    (raw) => {
      const win = loadSimulator();
      const entered = parseFloat(raw);
      const used = capacityUsed(raw);
      const expectCoerced = used !== entered; // NaN !== anything ⇒ coerced

      const findings = evalIn(win,
        `collectRunLevelFindings({ enteredCapacity: ${entered}, usedCapacity: ${used}, enteredIterations: 5000, usedIterations: 5000 })`);
      expect(Array.isArray(findings)).toBe(true);

      const flagged = findings.filter(f => f.code === 'CAPACITY_COERCED');
      expect(flagged.length === 1).toBe(expectCoerced);
      if (expectCoerced) {
        const f = flagged[0];
        expect(f.severity).toBe('WARNING');
        expect(f.locators.some(l => l.kind === 'run')).toBe(true);
        expect(`${f.message} ${f.impact || ''}`).toContain(String(used));
      }
      // Iterations entered === used here ⇒ never an ITERATIONS_CLAMPED.
      expect(findings.filter(f => f.code === 'ITERATIONS_CLAMPED')).toHaveLength(0);
    },
  );
});

// ─── PROPERTY 2: ITERATIONS_CLAMPED ⇔ used !== entered ──────────────────────
describe('0023 Phase 2 — ITERATIONS_CLAMPED is present iff the used Iterations differs from the entered value', () => {
  test.prop([RAW_ITERATIONS], { numRuns: 60 })(
    'reports ITERATIONS_CLAMPED iff the clamped/defaulted value !== the entered integer, naming the used value',
    (raw) => {
      const win = loadSimulator();
      const entered = parseInt(raw, 10);
      const used = iterationsUsed(raw);
      const expectClamped = used !== entered;

      const findings = evalIn(win,
        `collectRunLevelFindings({ enteredCapacity: 120, usedCapacity: 120, enteredIterations: ${entered}, usedIterations: ${used} })`);
      expect(Array.isArray(findings)).toBe(true);

      const flagged = findings.filter(f => f.code === 'ITERATIONS_CLAMPED');
      expect(flagged.length === 1).toBe(expectClamped);
      if (expectClamped) {
        const f = flagged[0];
        expect(f.severity).toBe('WARNING');
        expect(f.locators.some(l => l.kind === 'run')).toBe(true);
        expect(`${f.message} ${f.impact || ''}`).toContain(String(used));
      }
      // Capacity entered === used here ⇒ never a CAPACITY_COERCED.
      expect(findings.filter(f => f.code === 'CAPACITY_COERCED')).toHaveLength(0);
    },
  );
});
