// Feature 0024 — Empirical (distributional) lognormal parameters mode.
// PHASE 1 acceptance tests (engine + baked constants), scenarios AT-1..AT-5
// from docs/plans/0024-empirical-distributional-params.md.
//
// Each scenario is observable from OUTSIDE the system via the loaded-window
// globals (`T_SHIRT_PARAMS_DISTRIBUTIONAL`, `RATIO_RESIDUALS`, `activeParams`,
// `activeSampler`) and a seeded Run of `runScenario` / the samplers — never by
// reading the diff. Phase 1 activates the new mode DIRECTLY through the module
// seam (`activeParams` + `activeSampler`); the radio UI arrives in Phase 2.
//
// ── Autonomous atdd seam decisions (recorded in handover-04-atdd-p1.md) ──
//  (S1) The residual-multiplying sampler is reached through the module-scoped
//       function pointer `activeSampler`, set to the function named
//       `sampleLognormalWithResidual`. Phase 1 has NO UI handler to populate
//       `activeSampler`, so the test must name the function to enter the new
//       mode at the module level. This pins the plan's *suggested* name as the
//       Phase-1 seam contract (implement MUST define `sampleLognormalWithResidual`).
//  (S2) Draw order INSIDE the new-mode sampler is **lognormal draw first, then
//       the residual draw** (the plan's recommended order). AC-2/PBT-2 require a
//       directly-computable oracle, which is only well-defined once the order is
//       fixed; the reconstruction below replays draws in that order. implement
//       MUST use this order (it affects only the new mode's own values).
//
// ── RED on the pre-feature base ──
// `T_SHIRT_PARAMS_DISTRIBUTIONAL`, `RATIO_RESIDUALS`, `activeSampler`, and
// `sampleLognormalWithResidual` are all UNDEFINED on the base, so AT-1/AT-2/
// AT-3/AT-5 fail their first symbol-presence guard or assert against undefined,
// and AT-4's round-trip half (which enters the new mode) leaves the synthetic
// table in place, so the "new mode differs from synthetic" assertion fails.
// The synthetic/empirical golden-reproduction sub-tests are already-green
// regression guards; each file is RED overall via the new-mode assertions.
// This session does NOT touch index.html.

import { describe, it, expect } from 'vitest';
import { loadSimulator, read, evalIn, execIn, typeOf } from '../harness.js';

// Determinism: a fixed seed + Box-Muller reset before every sampling assertion.
const SEED = 424242;

// Fixed `runScenario` inputs for the AT-4 byte-identical golden vectors.
const RUN = { K: 5, LAMBDA: 3, ITERS: 50, DIST: ['XS', 'S', 'M', 'L', 'XL'] };

// AT-4 GOLDEN VECTORS — captured from the PRE-FEATURE tree (HEAD, before the
// distributional mode exists) for SEED + RUN, under each parameter table. The
// Synthetic/Empirical sampling paths are untouched by Phase 1, so these must
// reproduce byte-for-byte after implementation.
const SYNTH_GOLDEN = [
  19.704968370221216, 21.228018517485946, 22.553695882312677, 23.837372503953763, 23.91938782312799,
  24.178114629441154, 26.350759738138034, 26.445788414532238, 27.310626703529046, 27.680370986169947,
  29.118329600670265, 29.523496502516377, 31.33589553104337, 31.55087061125446, 33.309804146145034,
  33.51979101726626, 35.91192769418673, 36.41201040522, 36.783554798183445, 36.98223122012442,
  37.41915189844316, 39.203406614255954, 40.345157226700216, 40.45301036557044, 41.32368151973779,
  41.51417413114736, 43.92376722112847, 45.10761741592801, 46.70934714460277, 46.96992966140874,
  48.17453024982484, 49.348856054424466, 49.78971118639467, 51.57308845635579, 53.31938109431768,
  53.60861420553926, 55.38118861578608, 57.05578214981128, 57.42068280219126, 58.08735687034109,
  58.59580767220326, 60.626726517730816, 63.25960117458643, 63.29127820750554, 69.55157914589347,
  74.40322194315513, 76.0675511958734, 76.12687266590895, 83.33966434519604, 84.1838439700836,
];
const EMP_GOLDEN = [
  24.137274717616446, 26.396844667322885, 26.620470835309373, 27.193257963964996, 29.527863954533778,
  29.829217251271473, 31.659894557334365, 33.610468436951784, 34.568145783752456, 34.59764942187203,
  34.76823147106249, 34.982982537778085, 35.16427241679041, 35.380787598671745, 38.05914797820765,
  41.65053614923588, 41.91776624541229, 42.28962206221757, 43.87229903648581, 46.39518192900145,
  46.710082406264675, 47.27866208101637, 47.72411851916709, 48.72918088549941, 49.99644590372087,
  53.10049598889019, 53.34246593544288, 53.690494543347285, 54.491762010428296, 55.688624690373516,
  56.32679333827193, 57.28542790557821, 59.12766556018232, 59.33287688509703, 60.39030857359119,
  63.76487889622421, 64.33128227525965, 65.7955586344892, 67.51893152972993, 68.59571862408791,
  70.67123445161597, 72.35524833058231, 73.59400346513956, 75.49102980281977, 75.49233076582424,
  87.72068440377535, 89.06524402709225, 89.40386919242673, 92.0747275469177, 92.31812484293609,
];

const arr = (win, code) => evalIn(win, `Array.from(${code})`);
const seedExpr = (s) => `rng = new Xoshiro128ss(${s}); resetBoxMuller();`;

describe('0024 Phase 1 AT-1 — new-mode per-epic effort = lognormal(distributional) × residual', () => {
  // Happy path — a calibrated size; effort = sampleLognormal(size) under the
  // distributional table, times the exact Ratio residual bootstrapChoice draws.
  it('multiplies the distributional lognormal draw by the exact bootstrapped Ratio residual for size M', () => {
    const win = loadSimulator();
    // Symbol-presence guard — crisp RED reason on the base.
    expect(typeOf(win, 'sampleLognormalWithResidual')).toBe('function');
    expect(typeOf(win, 'T_SHIRT_PARAMS_DISTRIBUTIONAL')).toBe('object');
    expect(typeOf(win, 'RATIO_RESIDUALS')).toBe('object');

    // actual: one new-mode draw for M.
    execIn(win, `${seedExpr(SEED)} activeParams = T_SHIRT_PARAMS_DISTRIBUTIONAL; activeSampler = sampleLognormalWithResidual;`);
    const actual = evalIn(win, "activeSampler('M')");

    // expected: re-seed identically and replay the draws in the pinned order
    // (lognormal first under the distributional table, then the residual).
    execIn(win, seedExpr(SEED));
    const ln = evalIn(win, "sampleLognormal('M')");
    const res = evalIn(win, 'bootstrapChoice(RATIO_RESIDUALS)');

    expect(actual).toBe(ln * res);
    expect(actual).toBeGreaterThan(0);
  });

  // Boundary — XL+ has σ ≈ 0.0372, so the lognormal draw is near-deterministic
  // and the residual factor dominates the per-epic effort.
  it('applies the residual factor for the near-deterministic boundary size XL+', () => {
    const win = loadSimulator();
    expect(typeOf(win, 'sampleLognormalWithResidual')).toBe('function');

    execIn(win, `${seedExpr(SEED)} activeParams = T_SHIRT_PARAMS_DISTRIBUTIONAL; activeSampler = sampleLognormalWithResidual;`);
    const actual = evalIn(win, "activeSampler('XL+')");

    execIn(win, seedExpr(SEED));
    const ln = evalIn(win, "sampleLognormal('XL+')");
    const res = evalIn(win, 'bootstrapChoice(RATIO_RESIDUALS)');

    expect(actual).toBe(ln * res);
    expect(actual).toBeGreaterThan(0);
    // The residual genuinely moved the value (this seed draws a residual ≠ 1).
    expect(actual).not.toBe(ln);
  });

  // Negative / error edge — an unknown size label yields 0 from sampleLognormal,
  // so the residual multiply gives 0 × residual = 0 (still non-negative).
  it('returns 0 for an unknown t-shirt size label (0 × residual), never negative', () => {
    const win = loadSimulator();
    expect(typeOf(win, 'sampleLognormalWithResidual')).toBe('function');

    execIn(win, `${seedExpr(SEED)} activeParams = T_SHIRT_PARAMS_DISTRIBUTIONAL; activeSampler = sampleLognormalWithResidual;`);
    const actual = evalIn(win, "activeSampler('NOT-A-SIZE')");
    expect(actual).toBe(0);
    expect(actual).toBeGreaterThanOrEqual(0);
  });
});

describe('0024 Phase 1 AT-2 — baked constants match the frozen calibration (AC-3/AC-6/I-2/I-4)', () => {
  it('binds each calibrated size (XS/S/M/L) to the Empirical (μ,σ) exactly', () => {
    const win = loadSimulator();
    const dist = read(win, 'T_SHIRT_PARAMS_DISTRIBUTIONAL');
    const emp = read(win, 'T_SHIRT_PARAMS_EMPIRICAL');
    expect(dist).toBeDefined();
    for (const size of ['XS', 'S', 'M', 'L']) {
      expect(dist[size]).toEqual(emp[size]);
    }
  });

  it('shifts each uncalibrated size (2XS/XL/XL+) μ by ln(1.40) and keeps the synthetic σ exactly', () => {
    const win = loadSimulator();
    const dist = read(win, 'T_SHIRT_PARAMS_DISTRIBUTIONAL');
    const syn = read(win, 'T_SHIRT_PARAMS');
    expect(dist).toBeDefined();
    for (const size of ['2XS', 'XL', 'XL+']) {
      expect(dist[size].sigma).toBe(syn[size].sigma); // σ preserved exactly
      expect(dist[size].mu).toBeCloseTo(syn[size].mu + Math.log(1.40), 3); // 4-dp baked literal
    }
  });

  it('shares an identical t-shirt-size key set across the three parameter tables (I-3)', () => {
    const win = loadSimulator();
    const dist = read(win, 'T_SHIRT_PARAMS_DISTRIBUTIONAL');
    const emp = read(win, 'T_SHIRT_PARAMS_EMPIRICAL');
    const syn = read(win, 'T_SHIRT_PARAMS');
    expect(dist).toBeDefined();
    const keys = (o) => Object.keys(o).sort();
    expect(keys(dist)).toEqual(keys(emp));
    expect(keys(dist)).toEqual(keys(syn));
  });

  it('has a mean-1 Ratio residual pool of strictly positive residuals (I-2/I-4)', () => {
    const win = loadSimulator();
    const residuals = read(win, 'RATIO_RESIDUALS');
    expect(Array.isArray(residuals)).toBe(true);
    expect(residuals.length).toBeGreaterThan(0);
    for (const r of residuals) expect(r).toBeGreaterThan(0);
    const mean = residuals.reduce((a, b) => a + b, 0) / residuals.length;
    expect(mean).toBeCloseTo(1, 4);
  });
});

describe('0024 Phase 1 AT-3 — uncalibrated-size centre uplift + spread injection (AC-5)', () => {
  // For an uncalibrated size, over a large N the new-mode sample mean ≈ 1.40× the
  // synthetic-mode mean AND the sample variance strictly exceeds the Empirical-
  // mode lognormal-only variance for that size.
  it('lifts the XL+ sample mean to ~1.40× synthetic and widens variance beyond the Empirical lognormal-only spread', () => {
    const win = loadSimulator();
    expect(typeOf(win, 'sampleLognormalWithResidual')).toBe('function');
    const N = 20000;
    const size = 'XL+';

    // New-mode sample mean + variance under the distributional table.
    const neu = evalIn(win, `(function(){
      ${seedExpr(SEED)}
      activeParams = T_SHIRT_PARAMS_DISTRIBUTIONAL; activeSampler = sampleLognormalWithResidual;
      let s = 0, s2 = 0; const N = ${N};
      for (let i = 0; i < N; i++) { const x = activeSampler('${size}'); s += x; s2 += x*x; }
      const mean = s / N; return { mean, variance: s2 / N - mean*mean };
    })()`);

    // Empirical-mode lognormal-only sample variance (no residual): for an
    // uncalibrated size the Empirical table carries the synthetic (μ,σ).
    const empVar = evalIn(win, `(function(){
      ${seedExpr(SEED)}
      activeParams = T_SHIRT_PARAMS_EMPIRICAL;
      let s = 0, s2 = 0; const N = ${N};
      for (let i = 0; i < N; i++) { const x = sampleLognormal('${size}'); s += x; s2 += x*x; }
      const mean = s / N; return s2 / N - mean*mean;
    })()`);

    // Synthetic-mode mean for the size (closed form).
    const syn = read(win, 'T_SHIRT_PARAMS')[size];
    const synMean = Math.exp(syn.mu + (syn.sigma * syn.sigma) / 2);

    expect(neu.mean / synMean).toBeCloseTo(1.40, 1); // centre uplift ≈ 1.40×
    expect(neu.variance).toBeGreaterThan(empVar); // spread strictly widened
  });
});

describe('0024 Phase 1 AT-4 — Synthetic and Empirical modes stay byte-identical to the pre-feature app (I-1)', () => {
  // Regression guard (already green on the base): the synthetic path reproduces
  // its pre-feature golden vector exactly.
  it('reproduces the Synthetic-mode runScenario golden vector byte-for-byte', () => {
    const win = loadSimulator();
    execIn(win, `${seedExpr(SEED)} activeParams = T_SHIRT_PARAMS;`);
    const out = arr(win, `runScenario(${RUN.K}, ${RUN.LAMBDA}, ${JSON.stringify(RUN.DIST)}, ${RUN.ITERS})`);
    expect(out).toEqual(SYNTH_GOLDEN);
  });

  it('reproduces the Empirical-mode runScenario golden vector byte-for-byte', () => {
    const win = loadSimulator();
    execIn(win, `${seedExpr(SEED)} activeParams = T_SHIRT_PARAMS_EMPIRICAL;`);
    const out = arr(win, `runScenario(${RUN.K}, ${RUN.LAMBDA}, ${JSON.stringify(RUN.DIST)}, ${RUN.ITERS})`);
    expect(out).toEqual(EMP_GOLDEN);
  });

  // RED driver: a synthetic Run → new-mode Run → synthetic Run round-trip (each
  // re-seeded) must reproduce the synthetic golden on both synthetic legs, and
  // the new-mode leg must DIFFER (it consumes the extra residual draw and centres
  // differently). On the base the new mode does not exist, so its leg equals the
  // synthetic golden and the `not.toEqual` assertion fails.
  it('leaves no residual state: synthetic→new-mode→synthetic round-trip reproduces the synthetic golden, new-mode leg differs', () => {
    const win = loadSimulator();
    const synthRun = () => {
      execIn(win, `${seedExpr(SEED)} activeParams = T_SHIRT_PARAMS; activeSampler = sampleLognormal;`);
      return arr(win, `runScenario(${RUN.K}, ${RUN.LAMBDA}, ${JSON.stringify(RUN.DIST)}, ${RUN.ITERS})`);
    };
    const newModeRun = () => {
      execIn(win, `${seedExpr(SEED)} activeParams = T_SHIRT_PARAMS_DISTRIBUTIONAL; activeSampler = sampleLognormalWithResidual;`);
      return arr(win, `runScenario(${RUN.K}, ${RUN.LAMBDA}, ${JSON.stringify(RUN.DIST)}, ${RUN.ITERS})`);
    };

    const first = synthRun();
    const middle = newModeRun();
    const third = synthRun();

    expect(first).toEqual(SYNTH_GOLDEN);
    expect(third).toEqual(SYNTH_GOLDEN);
    expect(middle).not.toEqual(SYNTH_GOLDEN);
  });
});

describe('0024 Phase 1 AT-5 — Constant work follows the distributional table (AC-8)', () => {
  // Happy path — a calibrated size's deterministic constant-work mean matches
  // the Empirical mode (same baked (μ,σ)); the mean-1 residual does not apply to
  // the deterministic path.
  it('returns exp(μ+σ²/2) under the distributional table for the calibrated size M (matches Empirical)', () => {
    const win = loadSimulator();
    const dist = read(win, 'T_SHIRT_PARAMS_DISTRIBUTIONAL');
    expect(dist).toBeDefined();
    execIn(win, 'activeParams = T_SHIRT_PARAMS_DISTRIBUTIONAL;');
    const pm = evalIn(win, "tshirtToPersonMonths('M')");
    expect(pm).toBeCloseTo(Math.exp(dist.M.mu + (dist.M.sigma * dist.M.sigma) / 2), 10);

    const emp = read(win, 'T_SHIRT_PARAMS_EMPIRICAL');
    expect(pm).toBeCloseTo(Math.exp(emp.M.mu + (emp.M.sigma * emp.M.sigma) / 2), 10);
  });

  // Boundary — an uncalibrated size's constant-work mean is 1.40× its synthetic mean.
  it('lifts the uncalibrated size XL+ constant-work mean to 1.40× the synthetic mean', () => {
    const win = loadSimulator();
    const dist = read(win, 'T_SHIRT_PARAMS_DISTRIBUTIONAL');
    expect(dist).toBeDefined();
    const syn = read(win, 'T_SHIRT_PARAMS')['XL+'];
    const synMean = Math.exp(syn.mu + (syn.sigma * syn.sigma) / 2);
    execIn(win, 'activeParams = T_SHIRT_PARAMS_DISTRIBUTIONAL;');
    const pm = evalIn(win, "tshirtToPersonMonths('XL+')");
    expect(pm / synMean).toBeCloseTo(1.40, 3);
  });

  // Negative / error edge — an unknown size still contributes 0 PM (unchanged).
  it('returns 0 PM for an unknown size under the distributional table', () => {
    const win = loadSimulator();
    expect(read(win, 'T_SHIRT_PARAMS_DISTRIBUTIONAL')).toBeDefined();
    execIn(win, 'activeParams = T_SHIRT_PARAMS_DISTRIBUTIONAL;');
    expect(evalIn(win, "tshirtToPersonMonths('NOT-A-SIZE')")).toBe(0);
  });
});
