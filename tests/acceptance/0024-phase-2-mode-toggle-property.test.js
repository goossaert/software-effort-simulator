// Feature 0024 — Empirical (distributional) lognormal parameters mode.
// PHASE 2 property/inner tests — PBT-4 from the plan's "Properties / invariants
// to PBT" table (the tri-state `param-mode` toggle).
//
// PBT framework: fast-check via @fast-check/vitest `test.prop` (pbt.framework).
// The mode domain is the three contracted radio values; the per-mode expected
// table / sampler / label are READ FROM THE LOADED WINDOW (by reference), never
// hand-rolled copies, so the property tracks the real module bindings.
//
// One shared window — each property run fully re-establishes its state by
// dispatching `change` on the chosen radio (which reassigns activeParams +
// activeSampler and re-toggles all three labels), so cross-run order
// independence holds and the adversarial cases (re-selecting the same mode, and
// round-tripping back to empirical) are covered by the generator revisiting
// values.
//
// ── RED on the current base (post-Phase-1, no UI wiring) ──
// The `empirical-distributional` radio and the `param-label-empirical-
// distributional` label do NOT exist, and the base handler never assigns
// `activeSampler`. So: the `empirical-distributional` case throws on the null
// radio; the `synthetic`/`empirical` cases throw when the property checks the
// (missing) third label's `.active` state. The property therefore fails for the
// stated reason — the tri-state wiring is absent — shrinking to a minimal mode.
// This session does NOT touch index.html.

import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { loadSimulator, read } from '../harness.js';

// One shared window; every run re-establishes the binding it asserts.
const win = loadSimulator();

const MODES = ['synthetic', 'empirical', 'empirical-distributional'];

// mode → the global name the binding must point at (read by reference from win).
const EXPECTED_TABLE = {
  synthetic: 'T_SHIRT_PARAMS',
  empirical: 'T_SHIRT_PARAMS_EMPIRICAL',
  'empirical-distributional': 'T_SHIRT_PARAMS_DISTRIBUTIONAL',
};
const EXPECTED_SAMPLER = {
  synthetic: 'sampleLognormal',
  empirical: 'sampleLognormal',
  'empirical-distributional': 'sampleLognormalWithResidual',
};

describe('0024 Phase 2 PBT-4 — the param-mode radio is a tri-state selector (table + sampler + single highlight)', () => {
  test.prop([fc.constantFrom(...MODES)])(
    'for every mode, dispatching change binds activeParams + activeSampler to the matching mode and leaves exactly the matching label .active',
    (mode) => {
      const r = win.document.querySelector(`input[name="param-mode"][value="${mode}"]`);
      r.checked = true;
      r.dispatchEvent(new win.Event('change', { bubbles: true }));

      // activeParams + activeSampler bound to the matching mode (by reference).
      expect(read(win, 'activeParams')).toBe(read(win, EXPECTED_TABLE[mode]));
      expect(read(win, 'activeSampler')).toBe(read(win, EXPECTED_SAMPLER[mode]));

      // Exactly one label .active — the matching one — across all three options.
      for (const m of MODES) {
        const lbl = win.document.getElementById(`param-label-${m}`);
        expect(lbl.classList.contains('active')).toBe(m === mode);
      }
    },
  );
});
