// Feature 0024 — Empirical (distributional) lognormal parameters mode.
// PHASE 1 property/inner tests — PBT-1, PBT-2, PBT-3 from the plan's
// "Properties / invariants to PBT" table.
//
// PBT framework: fast-check via @fast-check/vitest `test.prop` (pbt.framework).
// The t-shirt-size domain is READ FROM THE LOADED WINDOW — never hand-listed —
// via Object.keys(T_SHIRT_PARAMS_EMPIRICAL), which by invariant I-3 (asserted in
// the acceptance file's AT-2) shares its key set with T_SHIRT_PARAMS_DISTRIBUTIONAL.
// Reading the EMPIRICAL keys keeps the generator domain valid on the pre-feature
// base (where the distributional table does not yet exist), so the RED failures
// are crisp per-property assertion failures rather than a module-load crash.
// Shrinking is left ON (the default) so each RED run reports a minimal failing
// input.
//
// The atdd seam decisions (S1 residual sampler named `sampleLognormalWithResidual`;
// S2 lognormal-draw-first-then-residual order) are documented in the acceptance
// file header and in handover-04-atdd-p1.md.
//
// RED on the pre-feature base: `T_SHIRT_PARAMS_DISTRIBUTIONAL`, `RATIO_RESIDUALS`,
// `activeSampler`, and `sampleLognormalWithResidual` are UNDEFINED, so the
// distributional-table reads and the new-mode sampler calls yield undefined and
// every property fails (shrinking to a minimal size / seed). This session does
// NOT touch index.html.

import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { loadSimulator, read, evalIn, execIn } from '../harness.js';

// One shared window — every property fully re-establishes the module state it
// needs (seed + Box-Muller reset + activeParams/activeSampler) before sampling,
// so cross-run order independence holds.
const win = loadSimulator();

// Domain read from the loaded window (NOT hand-listed): all seven t-shirt sizes.
const SIZES = Object.keys(read(win, 'T_SHIRT_PARAMS_EMPIRICAL'));

// The calibration membership (which sizes had Q1 data) — a domain fact from
// CONTEXT.md / ADR-0038, the analogue of the plan hand-listing the uncalibrated
// trio for PBT-3.
const CALIBRATED = new Set(['XS', 'S', 'M', 'L']);
const UNCALIBRATED = ['2XS', 'XL', 'XL+'];

const SEED = 424242;

describe('0024 Phase 1 PBT-1 — distributional centre table follows the calibration rule (AC-3)', () => {
  test.prop([fc.constantFrom(...SIZES)])(
    'for every t-shirt size: calibrated → Empirical (μ,σ) exactly; uncalibrated → synthetic σ and μ shifted by ln(1.40)',
    (size) => {
      const dist = read(win, 'T_SHIRT_PARAMS_DISTRIBUTIONAL');
      const emp = read(win, 'T_SHIRT_PARAMS_EMPIRICAL');
      const syn = read(win, 'T_SHIRT_PARAMS');
      if (CALIBRATED.has(size)) {
        expect(dist[size]).toEqual(emp[size]);
      } else {
        expect(dist[size].sigma).toBe(syn[size].sigma);
        expect(dist[size].mu).toBeCloseTo(syn[size].mu + Math.log(1.40), 3);
      }
    },
  );
});

describe('0024 Phase 1 PBT-2 — new-mode effort = distributional lognormal × bootstrapped residual (AC-2)', () => {
  test.prop([fc.integer({ min: 1, max: 2 ** 31 - 1 }), fc.constantFrom(...SIZES)])(
    'for every seed and size, the new-mode effort equals sampleLognormal(size) × the residual bootstrapChoice draws, and is > 0',
    (seed, size) => {
      const s = JSON.stringify(size);
      // actual: one new-mode draw under the distributional table.
      execIn(win, `rng = new Xoshiro128ss(${seed}); resetBoxMuller(); activeParams = T_SHIRT_PARAMS_DISTRIBUTIONAL; activeSampler = sampleLognormalWithResidual;`);
      const actual = evalIn(win, `activeSampler(${s})`);

      // expected: re-seed identically, replay in the pinned order (lognormal
      // first under the distributional table, then the residual draw).
      execIn(win, `rng = new Xoshiro128ss(${seed}); resetBoxMuller();`);
      const ln = evalIn(win, `sampleLognormal(${s})`);
      const res = evalIn(win, 'bootstrapChoice(RATIO_RESIDUALS)');

      expect(actual).toBe(ln * res);
      expect(actual).toBeGreaterThan(0);
    },
  );
});

describe('0024 Phase 1 PBT-3 — uncalibrated centre uplift + spread injection (AC-5)', () => {
  test.prop([fc.constantFrom(...UNCALIBRATED)], { numRuns: 9 })(
    'for every uncalibrated size, sample mean ≈ 1.40× synthetic mean and variance strictly exceeds the Empirical lognormal-only variance',
    (size) => {
      const s = JSON.stringify(size);
      const N = 20000;

      const neu = evalIn(win, `(function(){
        rng = new Xoshiro128ss(${SEED}); resetBoxMuller();
        activeParams = T_SHIRT_PARAMS_DISTRIBUTIONAL; activeSampler = sampleLognormalWithResidual;
        let sum = 0, sumSq = 0; const N = ${N};
        for (let i = 0; i < N; i++) { const x = activeSampler(${s}); sum += x; sumSq += x*x; }
        const mean = sum / N; return { mean, variance: sumSq / N - mean*mean };
      })()`);

      const empVar = evalIn(win, `(function(){
        rng = new Xoshiro128ss(${SEED}); resetBoxMuller();
        activeParams = T_SHIRT_PARAMS_EMPIRICAL;
        let sum = 0, sumSq = 0; const N = ${N};
        for (let i = 0; i < N; i++) { const x = sampleLognormal(${s}); sum += x; sumSq += x*x; }
        const mean = sum / N; return sumSq / N - mean*mean;
      })()`);

      const syn = read(win, 'T_SHIRT_PARAMS')[size];
      const synMean = Math.exp(syn.mu + (syn.sigma * syn.sigma) / 2);

      expect(neu.mean / synMean).toBeCloseTo(1.40, 1);
      expect(neu.variance).toBeGreaterThan(empVar);
    },
  );
});
