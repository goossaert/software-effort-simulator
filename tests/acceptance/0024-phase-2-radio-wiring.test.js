// Feature 0024 — Empirical (distributional) lognormal parameters mode.
// PHASE 2 acceptance tests (UI + tri-state `change` handler), scenarios
// AT-1..AT-3 from docs/plans/0024-empirical-distributional-params.md.
//
// Each scenario is observable from OUTSIDE the system — the DOM state of the
// `param-mode` radio group, the module-scoped `activeParams` / `activeSampler`
// references every sampler reads through, the absence of any persisted state,
// and the static T-shirt size reference panel's DOM — never by reading the diff.
//
// The Phase-1 engine slice is already in the base (HEAD): the two baked
// constants, the `activeSampler` function pointer (default `sampleLognormal`),
// and `sampleLognormalWithResidual`. Phase 2 adds ONLY the third radio + the
// tri-state `change` handler that swaps the table, the sampler, and the `.active`
// highlight across three modes.
//
// ── RED on the current base (post-Phase-1, no UI wiring) ──
// The third `<input name="param-mode" value="empirical-distributional">` does NOT
// exist, so its querySelector returns `null` and AT-1/AT-2/AT-3 throw on their
// first reference to it. The base handler only maps `empirical`↔`synthetic` and
// never assigns `activeSampler`, so even if the radio existed, selecting it would
// not bind `activeParams`/`activeSampler` to the distributional mode nor set the
// `param-label-empirical-distributional` `.active`. AT-3's "localStorage stays
// empty" and "reference panel unchanged" sub-assertions are already-green
// regression guards; the file is RED overall via the new-option assertions.
// This session does NOT touch index.html.

import { describe, it, expect } from 'vitest';
import { loadSimulator, read, evalIn, execIn, typeOf } from '../harness.js';

const radio = (win, value) =>
  win.document.querySelector(`input[name="param-mode"][value="${value}"]`);
const label = (win, value) => win.document.getElementById(`param-label-${value}`);
const optionsContainer = (win) => win.document.getElementById('param-mode-options');
// The static, never-re-rendered reference panel (band-as-definition).
const referencePanelHtml = (win) =>
  win.document.querySelector('.size-table').outerHTML;

const SEED = 424242;
const seedExpr = (s) => `rng = new Xoshiro128ss(${s}); resetBoxMuller();`;

const select = (win, value) => {
  const r = radio(win, value);
  r.checked = true;
  r.dispatchEvent(new win.Event('change', { bubbles: true }));
};

describe('0024 Phase 2 AT-1 — the third radio option is present, labelled, and placed last (AC-1/DC-1)', () => {
  // Happy path — the new option exists with the contracted value + visible label.
  it('renders a third param-mode radio with value "empirical-distributional" and a label containing "Empirical (distributional)"', () => {
    const win = loadSimulator(); // a page-load with no user interaction

    const newRadio = radio(win, 'empirical-distributional');
    expect(newRadio).not.toBeNull();
    expect(newRadio.getAttribute('name')).toBe('param-mode');

    const newLabel = label(win, 'empirical-distributional');
    expect(newLabel).not.toBeNull();
    expect(newLabel.textContent).toContain('Empirical (distributional)');
  });

  // Boundary — DOM order: the new option is placed AFTER synthetic and empirical.
  it('places the new option last in the Lognormal Parameters group, after synthetic and empirical', () => {
    const win = loadSimulator();

    const radios = Array.from(
      optionsContainer(win).querySelectorAll('input[name="param-mode"]'),
    ).map((el) => el.value);

    expect(radios).toEqual(['synthetic', 'empirical', 'empirical-distributional']);
  });

  // Negative — adding the new option must NOT change which option is checked on
  // load: Empirical stays the default; synthetic and the new option are unchecked.
  it('keeps Empirical the checked default on load, with synthetic and the new option unchecked', () => {
    const win = loadSimulator();

    expect(radio(win, 'empirical').checked).toBe(true);
    expect(radio(win, 'synthetic').checked).toBe(false);
    expect(radio(win, 'empirical-distributional').checked).toBe(false);
  });
});

describe('0024 Phase 2 AT-2 — selecting the new radio swaps table + sampler + highlight (AC-1/DC-2)', () => {
  // Happy path — selecting the new mode binds activeParams to the distributional
  // table, activeSampler to the residual sampler, and highlights exactly the new
  // label (the other two cleared).
  it('binds activeParams to the distributional table, activeSampler to the residual sampler, and activates only the new label', () => {
    const win = loadSimulator();
    expect(radio(win, 'empirical-distributional')).not.toBeNull();

    select(win, 'empirical-distributional');

    expect(read(win, 'activeParams')).toBe(read(win, 'T_SHIRT_PARAMS_DISTRIBUTIONAL'));
    expect(read(win, 'activeSampler')).toBe(read(win, 'sampleLognormalWithResidual'));

    // Exactly one label active — the new option's — the other two cleared.
    expect(label(win, 'empirical-distributional').classList.contains('active')).toBe(true);
    expect(label(win, 'synthetic').classList.contains('active')).toBe(false);
    expect(label(win, 'empirical').classList.contains('active')).toBe(false);
  });

  // Behavioral confirmation — "a new-mode Run now multiplies by a residual": after
  // selecting the new mode, a seeded per-epic effort equals the distributional
  // lognormal draw × the bootstrapped Ratio residual (lognormal-first order, S2).
  it('makes a seeded sample multiply the distributional lognormal draw by a bootstrapped residual after selection', () => {
    const win = loadSimulator();
    expect(typeOf(win, 'sampleLognormalWithResidual')).toBe('function');

    select(win, 'empirical-distributional');

    execIn(win, seedExpr(SEED));
    const actual = evalIn(win, "activeSampler('M')");

    execIn(win, seedExpr(SEED));
    const ln = evalIn(win, "sampleLognormal('M')");
    const res = evalIn(win, 'bootstrapChoice(RATIO_RESIDUALS)');

    expect(actual).toBe(ln * res);
    expect(actual).toBeGreaterThan(0);
  });

  // Boundary / round-trip — re-selecting Empirical restores the Empirical table,
  // the plain lognormal sampler, and moves .active back (regression on the two
  // pre-existing modes survives the third option).
  it('restores activeParams, activeSampler, and the highlight when Empirical is re-selected after the new mode', () => {
    const win = loadSimulator();
    expect(radio(win, 'empirical-distributional')).not.toBeNull();

    select(win, 'empirical-distributional');
    select(win, 'empirical');

    expect(read(win, 'activeParams')).toBe(read(win, 'T_SHIRT_PARAMS_EMPIRICAL'));
    expect(read(win, 'activeSampler')).toBe(read(win, 'sampleLognormal'));

    expect(label(win, 'empirical').classList.contains('active')).toBe(true);
    expect(label(win, 'synthetic').classList.contains('active')).toBe(false);
    expect(label(win, 'empirical-distributional').classList.contains('active')).toBe(false);
  });

  // Negative — selecting Synthetic from the new mode must clear the new mode's
  // binding entirely (activeSampler back to the plain lognormal, not the residual
  // sampler), proving the handler reassigns BOTH references, not just the table.
  it('clears the residual sampler when Synthetic is selected from the new mode', () => {
    const win = loadSimulator();
    expect(radio(win, 'empirical-distributional')).not.toBeNull();

    select(win, 'empirical-distributional');
    select(win, 'synthetic');

    expect(read(win, 'activeParams')).toBe(read(win, 'T_SHIRT_PARAMS'));
    expect(read(win, 'activeSampler')).toBe(read(win, 'sampleLognormal'));
    expect(read(win, 'activeSampler')).not.toBe(read(win, 'sampleLognormalWithResidual'));
    expect(label(win, 'synthetic').classList.contains('active')).toBe(true);
    expect(label(win, 'empirical-distributional').classList.contains('active')).toBe(false);
  });
});

describe('0024 Phase 2 AT-3 — selecting the new mode is ephemeral and leaves the reference panel untouched (AC-7/DC-4/ADR-0038 dec. 9)', () => {
  // Happy path — a brand-new page-load after the new mode was selected defaults
  // back to Empirical; nothing carried over from the first window.
  it('defaults a fresh page-load to Empirical even after a prior window selected the new mode', () => {
    const first = loadSimulator();
    select(first, 'empirical-distributional');
    // Sanity: the toggle moved the binding in that window.
    expect(read(first, 'activeParams')).toBe(read(first, 'T_SHIRT_PARAMS_DISTRIBUTIONAL'));

    const second = loadSimulator();
    expect(radio(second, 'empirical').checked).toBe(true);
    expect(radio(second, 'empirical-distributional').checked).toBe(false);
    expect(read(second, 'activeParams')).toBe(read(second, 'T_SHIRT_PARAMS_EMPIRICAL'));
  });

  // Negative — no selection (across ALL THREE options) writes anything to
  // localStorage; no param-mode key is ever created (ephemeral — AC-7/DC-4).
  it('writes nothing to localStorage when any of the three options is selected', () => {
    const win = loadSimulator();
    expect(win.localStorage.length).toBe(0);

    select(win, 'synthetic');
    select(win, 'empirical-distributional');
    select(win, 'empirical');

    expect(win.localStorage.length).toBe(0);
    expect(win.localStorage.getItem('param-mode')).toBeNull();
  });

  // Boundary / invariant — the static T-shirt size reference panel is byte-
  // unchanged after selecting the new mode (it is not re-rendered — ADR-0038 dec. 9).
  it('leaves the T-shirt size reference panel DOM unchanged after selecting the new mode', () => {
    const win = loadSimulator();
    const before = referencePanelHtml(win);

    select(win, 'empirical-distributional');

    expect(referencePanelHtml(win)).toBe(before);
  });
});
