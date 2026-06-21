// Feature 0022 — Default to the Empirical lognormal parameters on page-load.
//
// The per-size PROPERTY from the plan's "Properties / invariants to PBT"
// (formalising AC-2 / invariant I-1) plus focused example tests that
// triangulate it, plus AT-3 (the bidirectional `param-mode` toggle regression
// guard — placed here because it shares the same DOM/seam vocabulary).
//
// PBT framework: fast-check via @fast-check/vitest `test.prop` (pbt.framework).
// The **Recognised t-shirt size** set is READ FROM THE LOADED WINDOW
// (Object.keys(T_SHIRT_PARAMS_EMPIRICAL)) — never hand-listed — so the property
// tracks the Empirical table itself, not a fixture copy. Shrinking is left ON
// (the default), so the RED run reports a minimal failing size.
//
// RED on the unmodified base, which still defaults to the **Synthetic
// parameters**: for the calibrated sizes XS/S/M/L the empirical μ is shifted
// from the synthetic μ, so on the base `activeParams[size].mu` (== synthetic) ≠
// the empirical μ and the property fails, shrinking to a minimal calibrated
// size. The carry-through sizes 2XS/XL/XL+ are the adversarial edge (empirical
// == synthetic by value) and pass on both sides — they cannot be what makes the
// property RED, which is exactly why the property is non-vacuous. AT-3 is
// already green on the base (the toggle works today); the file is RED overall
// via the property and the calibrated-size examples. The default-flip is
// implemented in /stage-implement — this session does NOT touch index.html.

import { describe, it, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { loadSimulator, read } from '../harness.js';

// Read the Recognised t-shirt size set from a loaded window (NOT hand-listed),
// so the generator domain is exactly the Empirical table's key set
// (2XS, XS, S, M, L, XL, XL+).
const RECOGNISED_SIZES = Object.keys(read(loadSimulator(), 'T_SHIRT_PARAMS_EMPIRICAL'));

describe('0022 — Empirical parameters are the page-load default (per Recognised t-shirt size)', () => {
  // The universally-quantified property: ∀ Recognised t-shirt size, a fresh
  // page-load (no interaction) binds activeParams[size] to the Empirical
  // table's entry for that size, BY VALUE. Generator domain = the table's own
  // key set; adversarial edges = the carry-through sizes (must still hold) and
  // the calibrated sizes (what makes a synthetic-on-load init fail).
  test.prop([fc.constantFrom(...RECOGNISED_SIZES)])(
    'for every Recognised t-shirt size, a fresh page-load binds activeParams[size] to the Empirical (μ, σ) by value',
    (size) => {
      const win = loadSimulator(); // fresh page-load, no user interaction
      const activeParams = read(win, 'activeParams');
      const empirical = read(win, 'T_SHIRT_PARAMS_EMPIRICAL');
      expect(activeParams[size].mu).toBe(empirical[size].mu);
      expect(activeParams[size].sigma).toBe(empirical[size].sigma);
    },
  );

  // Happy path — a calibrated size whose empirical μ is genuinely shifted from
  // the synthetic μ; the active table on load must carry the empirical values.
  it('binds the calibrated size M to the Empirical (μ, σ) on load', () => {
    const win = loadSimulator();
    const activeParams = read(win, 'activeParams');
    const empirical = read(win, 'T_SHIRT_PARAMS_EMPIRICAL');
    expect(activeParams['M']).toEqual(empirical['M']);
  });

  // Boundary / adversarial edge — a carry-through size where the empirical
  // entry equals the synthetic entry by value; the default must still resolve
  // through the Empirical table (and the carry-through invariant must hold).
  it('binds the carry-through size 2XS to the Empirical entry, which equals Synthetic by value', () => {
    const win = loadSimulator();
    const activeParams = read(win, 'activeParams');
    const empirical = read(win, 'T_SHIRT_PARAMS_EMPIRICAL');
    const synthetic = read(win, 'T_SHIRT_PARAMS');
    expect(activeParams['2XS']).toEqual(empirical['2XS']);
    expect(empirical['2XS']).toEqual(synthetic['2XS']); // carry-through: equal by value
  });

  // Negative — for a calibrated size the active μ on load must NOT be the
  // synthetic μ. This is what distinguishes a genuine empirical default from a
  // synthetic default that merely matches on the carry-through sizes.
  it('does not bind the calibrated size S to the Synthetic μ on load', () => {
    const win = loadSimulator();
    const activeParams = read(win, 'activeParams');
    const synthetic = read(win, 'T_SHIRT_PARAMS');
    expect(activeParams['S'].mu).not.toBe(synthetic['S'].mu);
  });
});

describe('0022 AT-3 — the bidirectional param-mode toggle is preserved (regression guard)', () => {
  it('swaps activeParams and the .active highlight both ways when the param-mode radios change', () => {
    const win = loadSimulator(); // defaults to empirical once implemented
    const synthetic = () => win.document.querySelector('input[name="param-mode"][value="synthetic"]');
    const empirical = () => win.document.querySelector('input[name="param-mode"][value="empirical"]');
    const synLabel = () => win.document.getElementById('param-label-synthetic');
    const empLabel = () => win.document.getElementById('param-label-empirical');

    // Select Synthetic → binding + highlight follow to synthetic.
    synthetic().checked = true;
    synthetic().dispatchEvent(new win.Event('change', { bubbles: true }));
    expect(read(win, 'activeParams')).toBe(read(win, 'T_SHIRT_PARAMS'));
    expect(synLabel().classList.contains('active')).toBe(true);
    expect(empLabel().classList.contains('active')).toBe(false);

    // Re-select Empirical → binding + highlight follow back to empirical.
    empirical().checked = true;
    empirical().dispatchEvent(new win.Event('change', { bubbles: true }));
    expect(read(win, 'activeParams')).toBe(read(win, 'T_SHIRT_PARAMS_EMPIRICAL'));
    expect(empLabel().classList.contains('active')).toBe(true);
    expect(synLabel().classList.contains('active')).toBe(false);
  });
});
