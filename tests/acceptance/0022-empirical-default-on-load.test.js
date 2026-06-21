// Feature 0022 — Default to the Empirical lognormal parameters on page-load.
//
// Acceptance scenarios AT-1, AT-2, AT-4 from
// docs/plans/0022-empirical-lognormal-default.md. Each is observable from
// OUTSIDE the system — the DOM state of the `param-mode` radio group, the
// module-scoped `activeParams` reference every sampler reads through, and the
// absence of any persisted state — never from reading the diff.
//
// RED on the unmodified base, which still defaults to the **Synthetic
// parameters**: on a fresh page-load the `synthetic` radio is `checked`,
// `#param-label-synthetic` carries `.active`, and `activeParams ===
// T_SHIRT_PARAMS`, so the new-default assertions (AT-1, AT-2, AT-4's
// fresh-load-defaults-to-empirical) fail. AT-4's "writes nothing to
// localStorage" assertions are already-green regression guards (nothing is
// persisted today); each test file is still RED overall via its new-default
// assertions. The default-flip itself is implemented in /stage-implement — this
// session does NOT touch index.html.

import { describe, it, expect } from 'vitest';
import { loadSimulator, read } from '../harness.js';

const empiricalRadio = (win) =>
  win.document.querySelector('input[name="param-mode"][value="empirical"]');
const syntheticRadio = (win) =>
  win.document.querySelector('input[name="param-mode"][value="synthetic"]');
const empiricalLabel = (win) => win.document.getElementById('param-label-empirical');
const syntheticLabel = (win) => win.document.getElementById('param-label-synthetic');

describe('0022 AT-1 — page-load selects the Empirical parameters radio', () => {
  it('checks the empirical radio and highlights its label, leaving synthetic unchecked and unhighlighted', () => {
    const win = loadSimulator(); // a page-load with no user interaction

    // Empirical parameters are the page-load default (happy path).
    expect(empiricalRadio(win).checked).toBe(true);
    expect(empiricalLabel(win).classList.contains('active')).toBe(true);

    // Synthetic parameters are the one-click alternative — not selected on load
    // (negative: the other mode must produce the opposite UI state).
    expect(syntheticRadio(win).checked).toBe(false);
    expect(syntheticLabel(win).classList.contains('active')).toBe(false);
  });
});

describe('0022 AT-2 — page-load binds activeParams to the Empirical parameters table', () => {
  it('initialises activeParams to T_SHIRT_PARAMS_EMPIRICAL by reference, not the Synthetic table', () => {
    const win = loadSimulator();
    const activeParams = read(win, 'activeParams');

    // Reference identity: every sampler (sampleLognormal, tshirtToPersonMonths)
    // reads the Empirical table without any user action (happy path).
    expect(activeParams).toBe(read(win, 'T_SHIRT_PARAMS_EMPIRICAL'));

    // And it is NOT the Synthetic table (negative).
    expect(activeParams).not.toBe(read(win, 'T_SHIRT_PARAMS'));
  });
});

describe('0022 AT-4 — the Empirical default is ephemeral (no persistence introduced)', () => {
  it('defaults a fresh page-load to empirical even after a prior window selected synthetic, and persists nothing to localStorage', () => {
    // One loaded window in which the synthetic radio was just selected.
    const first = loadSimulator();
    syntheticRadio(first).checked = true;
    syntheticRadio(first).dispatchEvent(new first.Event('change', { bubbles: true }));
    // Sanity: the toggle moved the binding to the Synthetic table in that window
    // (true on both the base and the implemented tree — not a RED driver).
    expect(read(first, 'activeParams')).toBe(read(first, 'T_SHIRT_PARAMS'));

    // A brand-new page-load again defaults to empirical (AT-1/AT-2 hold) —
    // nothing carried over from the first window (boundary: a reload resets).
    const second = loadSimulator();
    expect(empiricalRadio(second).checked).toBe(true);
    expect(read(second, 'activeParams')).toBe(read(second, 'T_SHIRT_PARAMS_EMPIRICAL'));

    // Selecting either radio writes nothing to localStorage — storage stays
    // empty and no param-mode / preference key is created (regression guard:
    // ADR-0026's ephemerality / ADR-0002's no-cross-session-state must hold).
    const win = loadSimulator();
    expect(win.localStorage.length).toBe(0);
    syntheticRadio(win).dispatchEvent(new win.Event('change', { bubbles: true }));
    empiricalRadio(win).dispatchEvent(new win.Event('change', { bubbles: true }));
    expect(win.localStorage.length).toBe(0);
    expect(win.localStorage.getItem('param-mode')).toBeNull();
  });
});
