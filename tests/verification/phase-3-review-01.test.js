// Independent verification tests for feature 0020, Phase 3.
//
// Targets a gap I identified while reading the plan + diff: the trivial-skip
// check for the confirmation modal.
//
// Plan (Phase 3, Invariants & §"Behavioral rule"):
//   The confirmation modal interposes iff
//     `groupsStore.length > 1 || (groupsStore.length === 1 && groupsStore[0].name !== 'All')`.
//   Empty store or **single auto-default `All` Group** skips the modal.
//
// Implementation (index.html `confirmLoadGroupsReplacement`):
//   `if (groupsStore.length <= 1) { _applyGroupsReplacement(...); return; }`
//
// Divergence: a single user-defined Group named anything other than 'All'
// (e.g. `Critical`, `KR1`, the result of a Phase 2 user-renamed auto-default)
// is non-trivial per the plan — the modal MUST interpose. The implementation
// skips the modal because it only checks length, not the name. The committed
// acceptance suite (AT-11/AT-12) only triangulates `length > 1` and
// `length === 1 && name === 'All'`; the `length === 1 && name !== 'All'` case
// is not covered.

import { describe, it, expect } from 'vitest';
import { loadSimulator, read, evalIn, execIn } from '../harness.js';

function setGroups(win, groups) {
  execIn(win, `groupsStore.length = 0; for (const g of ${JSON.stringify(groups)}) groupsStore.push(g);`);
}

function renderGroups(win) {
  execIn(win, 'renderGroupsTab();');
}

describe('verification: single non-All Group is non-trivial → modal MUST interpose', () => {
  it('a single Group named Critical (not All) triggers the confirmation modal', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'Critical', color: '#ea7c2c', members: ['Must'], isProjection: true },
    ]);
    renderGroups(win);

    execIn(win, `confirmLoadGroupsReplacement([
      { name: 'NewG', color: '#000', members: [], isProjection: true },
    ]);`);

    // Per the plan, this should open the modal AND leave groupsStore unchanged
    // until the user confirms. The current implementation skips the modal and
    // replaces immediately.
    const overlay = win.document.getElementById('groups-load-confirm-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.style.display, 'modal should be visible for a single non-All Group').not.toBe('none');

    // groupsStore should still hold the original Critical Group while the
    // modal awaits user confirmation.
    const groups = read(win, 'groupsStore');
    expect(groups.map(g => g.name), 'groupsStore should be untouched while modal is open').toEqual(['Critical']);
  });

  it('a single Group named KR1 (not All) also triggers the confirmation modal', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'KR1', color: '#4f46e5', members: ['KR1'], isProjection: true },
    ]);
    renderGroups(win);

    execIn(win, `confirmLoadGroupsReplacement([
      { name: 'NewG', color: '#000', members: [], isProjection: true },
    ]);`);

    const overlay = win.document.getElementById('groups-load-confirm-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.style.display).not.toBe('none');

    const groups = read(win, 'groupsStore');
    expect(groups.map(g => g.name)).toEqual(['KR1']);
  });
});
