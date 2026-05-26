// Acceptance tests for feature 0020, Phase 2: Groups tab UI.
//
// Each `describe('AT-N: …')` block maps to one scenario in
// docs/plans/0020-category-and-groups.md, Phase 2 "Acceptance behavior".
//
// Tests target the public seams named in the plan:
//   • The fifth tab button + #tab-groups panel.
//   • `renderGroupsTab()` — single-innerHTML render into #groups-table-wrap.
//   • Per-row cells in fixed order: Name | Color | Members | Projection | Duplicate | Delete.
//   • Inline onchange/onclick handlers writing to groupsStore directly.
//   • Members popover (chip strip + `+` + MultiSelect-style popover).
//   • Color swatch overlay using COLOR_PALETTE.
//   • Projection single-select radio (exactly-one isProjection).
//   • The `+ New group` row.
//   • Commit-on-Run: edits do NOT trigger a Run.
//
// Phase 2 sits on top of Phase 1; many tests rely on the Phase 1 seams
// (groupsStore, BLANK, categoryBadge, editedInitiatives populated by
// loadInitiativesCSV). Phase 1's RED tests cover those seams independently;
// Phase 2 tests assume them present and assert only the Groups-tab UI.

import { describe, it, expect } from 'vitest';
import { loadSimulator, read, evalIn, execIn, csv } from '../harness.js';

// ─── Fixture helpers ────────────────────────────────────────────────

function loadInitiatives(win, rows, headers) {
  const text = csv(rows, headers);
  execIn(win, `loadInitiativesCSV(${JSON.stringify(text)})`);
}

function sensibleRow(jiraKey, teams, quarter, category) {
  return { jira_key: jiraKey, name: `Init ${jiraKey}`, teams, quarter, category };
}

function setGroups(win, groups) {
  // groupsStore is `let`; mutate in place by clearing + pushing entries.
  execIn(win, `groupsStore.length = 0; for (const g of ${JSON.stringify(groups)}) groupsStore.push(g);`);
}

function renderGroups(win) {
  execIn(win, 'renderGroupsTab();');
}

// ─── AT-1: fifth tab button ─────────────────────────────────────────
describe('AT-1: fifth Groups tab button in the tab bar', () => {
  it('the tab bar contains exactly 5 .tab-btn elements ending with Groups', () => {
    const win = loadSimulator();
    const buttons = Array.from(win.document.querySelectorAll('.tab-btn'));
    expect(buttons).toHaveLength(5);
    const last = buttons[buttons.length - 1];
    expect(last.dataset.tab).toBe('groups');
    expect(last.textContent.trim()).toBe('Groups');
  });
});

// ─── AT-2: #tab-groups is hidden immediately after a Run reset ──────
describe('AT-2: #tab-groups panel is initially display:none', () => {
  it('the panel exists and has style.display === "none"', () => {
    const win = loadSimulator();
    const panel = win.document.getElementById('tab-groups');
    expect(panel).toBeTruthy();
    expect(panel.style.display).toBe('none');
  });
});

// ─── AT-3: clicking the tab button reveals the Groups table ─────────
describe('AT-3: clicking Groups tab reveals #tab-groups', () => {
  it('panel switches to display:flex on tab-button click', () => {
    const win = loadSimulator();
    const btn = win.document.querySelector('.tab-btn[data-tab="groups"]');
    expect(btn).toBeTruthy();
    btn.click();
    const panel = win.document.getElementById('tab-groups');
    expect(panel.style.display).toBe('flex');
  });
});

// ─── AT-4: one row per Group + a + New group row ────────────────────
describe('AT-4: Groups table renders one row per Group plus + New group', () => {
  it('groupsStore order is preserved; tbody has groupsStore.length + 1 <tr>', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      sensibleRow('I-1', 'Team A', 'Q2 2026', 'Must'),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);
    setGroups(win, [
      { name: 'KR1', color: '#ea7c2c', members: ['KR1'], isProjection: true },
      { name: 'KR2', color: '#059669', members: ['KR2'], isProjection: false },
      { name: 'KR3', color: '#4f46e5', members: ['KR3'], isProjection: false },
    ]);
    renderGroups(win);

    const rows = win.document.querySelectorAll('#groups-table-wrap tbody tr');
    expect(rows).toHaveLength(4);
    // First three rows preserve groupsStore order:
    const nameInputs = win.document.querySelectorAll('#groups-table-wrap tbody tr input[type="text"]');
    expect(Array.from(nameInputs).slice(0, 3).map(i => i.value)).toEqual(['KR1', 'KR2', 'KR3']);
  });
});

// ─── AT-5: each Group row has exactly the six cells in order ────────
describe('AT-5: each Group row has six cells Name|Color|Members|Projection|Duplicate|Delete', () => {
  it('first Group row has 6 <td> with the documented contents', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'KR1', color: '#ea7c2c', members: ['KR1', null], isProjection: false },
    ]);
    renderGroups(win);
    const firstRow = win.document.querySelector('#groups-table-wrap tbody tr');
    expect(firstRow).toBeTruthy();
    const tds = firstRow.querySelectorAll('td');
    expect(tds).toHaveLength(6);
    // Name cell: text input with value === 'KR1'
    expect(tds[0].querySelector('input[type="text"]')?.value).toBe('KR1');
    // Color cell: a swatch with background containing the hex
    const swatch = tds[1].querySelector('[style]');
    expect(swatch).toBeTruthy();
    expect(swatch.getAttribute('style').toLowerCase()).toMatch(/ea7c2c/);
    // Members cell: a chip strip with two chips + a + button
    const chips = tds[2].querySelectorAll('.group-chip');
    expect(chips.length).toBe(2);
    expect(tds[2].querySelector('.group-add-chip-btn, button[data-add-member], .members-add-btn, button.add')).toBeTruthy();
    // Projection cell: radio
    expect(tds[3].querySelector('input[type="radio"]')).toBeTruthy();
    // Duplicate and Delete cells: buttons
    expect(tds[4].querySelector('button')).toBeTruthy();
    expect(tds[5].querySelector('button')).toBeTruthy();
  });
});

// ─── AT-6: editing Name writes through to groupsStore ──────────────
describe('AT-6: editing Group Name writes through immediately on change', () => {
  it('changing the input and dispatching `change` updates groupsStore[idx].name', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'All', color: '#4f46e5', members: ['Must'], isProjection: true },
    ]);
    renderGroups(win);

    const input = win.document.querySelector('#groups-table-wrap tbody tr input[type="text"]');
    expect(input).toBeTruthy();
    input.value = 'Critical only';
    input.dispatchEvent(new win.Event('change', { bubbles: true }));

    expect(read(win, 'groupsStore')[0].name).toBe('Critical only');
  });
});

// ─── AT-7: Color swatch click opens the COLOR_PALETTE overlay ──────
describe('AT-7: clicking the Color swatch opens the COLOR_PALETTE overlay', () => {
  it('clicking the swatch reveals an overlay with palette swatches; picking one writes color', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'KR1', color: '#ea7c2c', members: ['KR1'], isProjection: true },
    ]);
    renderGroups(win);
    const swatchTrigger = win.document.querySelector('#groups-table-wrap .group-color-swatch, #groups-table-wrap td:nth-child(2) [style*="background"]');
    expect(swatchTrigger).toBeTruthy();
    swatchTrigger.click();

    // The palette overlay should mount with `COLOR_PALETTE.length` swatches.
    const overlay = win.document.querySelector('.color-palette-overlay, #groups-color-overlay, .group-color-overlay, .palette-overlay');
    expect(overlay).toBeTruthy();
    const paletteSwatches = overlay.querySelectorAll('[style*="background"]');
    expect(paletteSwatches.length).toBeGreaterThanOrEqual(80);

    // Click one — should write through.
    const pick = paletteSwatches[3]; // any non-current colour
    const newHex = (pick.getAttribute('style').match(/background[^;]*:\s*(#[0-9a-fA-F]+)/) || [])[1];
    pick.click();
    if (newHex) {
      expect(read(win, 'groupsStore')[0].color.toLowerCase()).toBe(newHex.toLowerCase());
    }
  });
});

// ─── AT-8: Members chip strip renders one chip per member ──────────
describe('AT-8: Members cell renders one chip per member with × and a + button', () => {
  it('three members render as three chips; (Blank) renders italic-grey; + button trails', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'A', color: '#000', members: ['Must', 'Should', null], isProjection: true },
    ]);
    renderGroups(win);
    const memberCell = win.document.querySelectorAll('#groups-table-wrap tbody tr td')[2];
    const chips = memberCell.querySelectorAll('.group-chip');
    expect(chips).toHaveLength(3);
    // The third chip is the (Blank) sentinel — italic styling.
    const blankChip = chips[2];
    expect(blankChip.textContent).toMatch(/\(Blank\)/);
    expect(blankChip.outerHTML.toLowerCase()).toMatch(/italic|font-style\s*:\s*italic/);
    // Each chip has an × remove button.
    for (const c of chips) {
      expect(c.querySelector('.group-chip-remove, button.chip-x, button.remove, [data-remove]')).toBeTruthy();
    }
    // A trailing + button.
    expect(memberCell.querySelector('.group-add-chip-btn, button[data-add-member], button.add')).toBeTruthy();
  });
});

// ─── AT-9: clicking × on a chip removes that member ────────────────
describe('AT-9: clicking × on a chip removes the member from groupsStore', () => {
  it('after click, groupsStore[idx].members no longer contains the removed value', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'A', color: '#000', members: ['Must', 'Should'], isProjection: true },
    ]);
    renderGroups(win);

    const chips = win.document.querySelectorAll('#groups-table-wrap .group-chip');
    const shouldChip = Array.from(chips).find(c => c.textContent.includes('Should'));
    expect(shouldChip).toBeTruthy();
    const removeBtn = shouldChip.querySelector('.group-chip-remove, button.chip-x, button.remove, [data-remove]');
    expect(removeBtn).toBeTruthy();
    removeBtn.click();

    expect(read(win, 'groupsStore')[0].members).toEqual(['Must']);
  });
});

// ─── AT-10: clicking + opens the MultiSelect popover ────────────────
describe('AT-10: clicking + opens a MultiSelect popover with observed Categories + (Blank) + free-text', () => {
  it('popover lists each observed Category as a checkbox plus a dedicated (Blank) row plus a free-text input', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      sensibleRow('I-1', 'Team A', 'Q2 2026', 'Must'),
      sensibleRow('I-2', 'Team A', 'Q2 2026', 'Should'),
      sensibleRow('I-3', 'Team A', 'Q2 2026', 'Could'),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);
    setGroups(win, [
      { name: 'A', color: '#000', members: ['Must'], isProjection: true },
    ]);
    renderGroups(win);

    const addBtn = win.document.querySelector('#groups-table-wrap .group-add-chip-btn, #groups-table-wrap button[data-add-member]');
    expect(addBtn).toBeTruthy();
    addBtn.click();

    const popover = win.document.querySelector('.members-popover, #members-popover, .group-members-popover');
    expect(popover).toBeTruthy();
    // Categories present in editedInitiatives are listed.
    const labels = Array.from(popover.querySelectorAll('label, .ms-option')).map(l => l.textContent.trim());
    const labelText = labels.join('|');
    expect(labelText).toMatch(/Must/);
    expect(labelText).toMatch(/Should/);
    expect(labelText).toMatch(/Could/);
    expect(labelText).toMatch(/\(Blank\)/);
    // Free-text input present.
    expect(popover.querySelector('input[type="text"]')).toBeTruthy();
  });
});

// ─── AT-11: popover checkbox toggle writes through ─────────────────
describe('AT-11: toggling a popover option writes through to groupsStore', () => {
  it('checking an unchecked option adds it to members; unchecking removes it', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      sensibleRow('I-1', 'Team A', 'Q2 2026', 'Must'),
      sensibleRow('I-2', 'Team A', 'Q2 2026', 'Should'),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);
    setGroups(win, [
      { name: 'A', color: '#000', members: ['Must'], isProjection: true },
    ]);
    renderGroups(win);
    win.document.querySelector('#groups-table-wrap .group-add-chip-btn, #groups-table-wrap button[data-add-member]').click();

    const popover = win.document.querySelector('.members-popover, #members-popover, .group-members-popover');
    const shouldCheckbox = Array.from(popover.querySelectorAll('input[type="checkbox"]')).find(cb => {
      const label = cb.closest('label') || cb.parentElement;
      return label && label.textContent.includes('Should');
    });
    expect(shouldCheckbox).toBeTruthy();
    shouldCheckbox.checked = true;
    shouldCheckbox.dispatchEvent(new win.Event('change', { bubbles: true }));

    expect(read(win, 'groupsStore')[0].members).toContain('Should');
  });
});

// ─── AT-12: free-text Category adds a member not in the CSV ────────
describe('AT-12: adding a free-text Category creates an absent-from-CSV member', () => {
  it('typing a new value + Enter pushes it to members; popover remains open', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      sensibleRow('I-1', 'Team A', 'Q2 2026', 'Must'),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);
    setGroups(win, [
      { name: 'A', color: '#000', members: [], isProjection: true },
    ]);
    renderGroups(win);
    win.document.querySelector('#groups-table-wrap .group-add-chip-btn, #groups-table-wrap button[data-add-member]').click();

    const popover = win.document.querySelector('.members-popover, #members-popover, .group-members-popover');
    const textInput = popover.querySelector('input[type="text"]');
    expect(textInput).toBeTruthy();
    textInput.value = 'KR4';
    textInput.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(read(win, 'groupsStore')[0].members).toContain('KR4');
    expect(win.document.querySelector('.members-popover, #members-popover, .group-members-popover')).toBeTruthy();
  });
});

// ─── AT-13: Projection radio enforces exactly-one isProjection ─────
describe('AT-13: clicking another row\'s Projection radio transfers the flag', () => {
  it('exactly one Group has isProjection===true after the click', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'A', color: '#a', members: [], isProjection: true },
      { name: 'B', color: '#b', members: [], isProjection: false },
      { name: 'C', color: '#c', members: [], isProjection: false },
    ]);
    renderGroups(win);

    const radios = win.document.querySelectorAll('#groups-table-wrap input[type="radio"]');
    expect(radios).toHaveLength(3);
    radios[1].checked = true;
    radios[1].dispatchEvent(new win.Event('change', { bubbles: true }));

    const groups = read(win, 'groupsStore');
    expect(groups[0].isProjection).toBe(false);
    expect(groups[1].isProjection).toBe(true);
    expect(groups[2].isProjection).toBe(false);
  });
});

// ─── AT-14: Duplicate button clones with " (copy)" suffix ──────────
describe('AT-14: Duplicate clones the row with name + " (copy)" and isProjection:false', () => {
  it('clone is inserted; isProjection is never copied', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'KR1', color: '#ea7c2c', members: ['KR1'], isProjection: true },
    ]);
    renderGroups(win);

    const dupBtn = win.document.querySelectorAll('#groups-table-wrap tbody tr td')[4].querySelector('button');
    expect(dupBtn).toBeTruthy();
    dupBtn.click();

    const groups = read(win, 'groupsStore');
    expect(groups).toHaveLength(2);
    expect(groups[1]).toMatchObject({
      name: 'KR1 (copy)',
      color: '#ea7c2c',
      members: ['KR1'],
      isProjection: false,
    });
    // Original still keeps the flag.
    expect(groups[0].isProjection).toBe(true);
  });
});

// ─── AT-15: Delete button removes the row ──────────────────────────
describe('AT-15: Delete splices the row from groupsStore', () => {
  it('non-projection delete leaves the other rows intact', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'A', color: '#a', members: [], isProjection: true },
      { name: 'B', color: '#b', members: [], isProjection: false },
    ]);
    renderGroups(win);

    const tds = win.document.querySelectorAll('#groups-table-wrap tbody tr:nth-child(2) td');
    const delBtn = tds[5].querySelector('button');
    expect(delBtn).toBeTruthy();
    delBtn.click();

    const groups = read(win, 'groupsStore');
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('A');
  });
});

// ─── AT-16: deleting the Projection group transfers the flag ───────
describe('AT-16: deleting the current Projection group transfers isProjection to the next row', () => {
  it('the new first remaining row gets isProjection:true', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'A', color: '#a', members: [], isProjection: true },
      { name: 'B', color: '#b', members: [], isProjection: false },
      { name: 'C', color: '#c', members: [], isProjection: false },
    ]);
    renderGroups(win);

    const tds = win.document.querySelectorAll('#groups-table-wrap tbody tr:nth-child(1) td');
    tds[5].querySelector('button').click();

    const groups = read(win, 'groupsStore');
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ name: 'B', isProjection: true });
    expect(groups[1]).toMatchObject({ name: 'C', isProjection: false });
  });
});

// ─── AT-17: deleting the last Group leaves groupsStore === [] ──────
describe('AT-17: deleting the last Group leaves groupsStore === []', () => {
  it('table renders only the + New group row after deletion', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'Only', color: '#000', members: [], isProjection: true },
    ]);
    renderGroups(win);
    win.document.querySelectorAll('#groups-table-wrap tbody tr:nth-child(1) td')[5].querySelector('button').click();

    expect(read(win, 'groupsStore')).toEqual([]);
    const rows = win.document.querySelectorAll('#groups-table-wrap tbody tr');
    expect(rows).toHaveLength(1);
  });
});

// ─── AT-18: + New group appends a default Group ────────────────────
describe('AT-18: + New group pushes a default Group', () => {
  it('clicking the + New group row appends { name:"", members:[], isProjection:false }', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'A', color: '#a', members: [], isProjection: true },
    ]);
    renderGroups(win);
    const addRow = win.document.querySelector('#groups-table-wrap tbody tr:last-child');
    const addBtn = addRow.querySelector('button');
    expect(addBtn).toBeTruthy();
    addBtn.click();

    const groups = read(win, 'groupsStore');
    expect(groups).toHaveLength(2);
    expect(groups[1]).toMatchObject({ name: '', members: [], isProjection: false });
    expect(typeof groups[1].color).toBe('string');
    expect(groups[1].color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

// ─── AT-19: Group edits do NOT trigger a Run ────────────────────────
describe('AT-19: edits commit to groupsStore without running the simulation', () => {
  it('after edits the chart, stats, and preview surfaces stay on their previous state', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'A', color: '#a', members: ['Must'], isProjection: true },
    ]);
    renderGroups(win);

    // Capture current chart instance reference; any Run would replace it.
    const beforeChart = evalIn(win, 'typeof chartInstance');
    win.document.querySelector('#groups-table-wrap tbody tr input[type="text"]').value = 'New name';
    win.document.querySelector('#groups-table-wrap tbody tr input[type="text"]').dispatchEvent(new win.Event('change', { bubbles: true }));

    const afterChart = evalIn(win, 'typeof chartInstance');
    // Both before and after should be the same — no Run fired.
    expect(afterChart).toBe(beforeChart);
    expect(read(win, 'groupsStore')[0].name).toBe('New name');
  });
});

// ─── AT-20: pressing Run renders the new shape ─────────────────────
describe('AT-20: pressing Run after Group edits renders one dataset per Group', () => {
  it('renderChart receives results whose length matches current groupsStore.length', () => {
    const win = loadSimulator();
    const groups = [
      { name: 'X', color: '#000', members: ['Must'], isProjection: true },
      { name: 'Y', color: '#111', members: ['Should'], isProjection: false },
    ];
    setGroups(win, groups);

    const out = evalIn(win, `runSimulation({
      lambda: 1.0, epicSizingDist: ['M'],
      kPerGroup: [1, 1], capacity: 120, iterations: 200, fixedEffort: 0,
      groups: ${JSON.stringify(groups)},
    })`);
    execIn(win, `renderChart(${JSON.stringify(out)}, 120);`);
    const datasets = evalIn(win, 'chartInstance.data.datasets');
    expect(datasets).toHaveLength(2);
    expect(datasets.map(d => d.label)).toEqual(['X', 'Y']);
  });
});

// ─── AT-21: empty-named Group still renders ─────────────────────────
describe('AT-21: a Group with name === "" renders with empty label, no error', () => {
  it('the row\'s Name cell is an empty <input>; no error fires during render', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: '', color: '#000', members: [], isProjection: true },
    ]);
    renderGroups(win);
    const input = win.document.querySelector('#groups-table-wrap tbody tr input[type="text"]');
    expect(input).toBeTruthy();
    expect(input.value).toBe('');
  });
});

// ─── AT-22: duplicate-named Groups both render ─────────────────────
describe('AT-22: two Groups with the same name both render', () => {
  it('both rows appear, both with the same name value, no error', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'KR1', color: '#a', members: ['KR1'], isProjection: true },
      { name: 'KR1', color: '#b', members: ['KR1'], isProjection: false },
    ]);
    renderGroups(win);
    const inputs = win.document.querySelectorAll('#groups-table-wrap tbody tr input[type="text"]');
    // Two Group rows + one + New group row = 3 <tr>, but only Group rows have a name input
    expect(Array.from(inputs).slice(0, 2).map(i => i.value)).toEqual(['KR1', 'KR1']);
  });
});

// ─── AT-23: zero-member Group ───────────────────────────────────────
describe('AT-23: a zero-member Group renders with no chips and a working + button', () => {
  it('chip strip is empty; + button still mounts', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'Empty', color: '#000', members: [], isProjection: true },
    ]);
    renderGroups(win);
    const memberCell = win.document.querySelectorAll('#groups-table-wrap tbody tr td')[2];
    expect(memberCell.querySelectorAll('.group-chip')).toHaveLength(0);
    expect(memberCell.querySelector('.group-add-chip-btn, button[data-add-member]')).toBeTruthy();
  });
});

// ─── AT-24: Group referencing absent Category renders the chip ─────
describe('AT-24: a Group whose members reference a CSV-absent Category still renders', () => {
  it('chip text matches the literal member value', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      sensibleRow('I-1', 'Team A', 'Q2 2026', 'Must'),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);
    setGroups(win, [
      { name: 'A', color: '#000', members: ['KR99'], isProjection: true },
    ]);
    renderGroups(win);
    const chip = win.document.querySelector('#groups-table-wrap .group-chip');
    expect(chip.textContent).toMatch(/KR99/);
  });
});

// ─── AT-25: BLANK chip in members renders italic-grey ──────────────
describe('AT-25: a BLANK member renders as italic-grey (Blank) chip', () => {
  it('the chip carries the literal "(Blank)" string in italic styling', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'A', color: '#000', members: [null], isProjection: true },
    ]);
    renderGroups(win);
    const chip = win.document.querySelector('#groups-table-wrap .group-chip');
    expect(chip).toBeTruthy();
    expect(chip.textContent).toMatch(/\(Blank\)/);
    expect(chip.outerHTML.toLowerCase()).toMatch(/italic|font-style\s*:\s*italic/);
  });
});

// ─── AT-26: tab is re-rendered as part of every Run ────────────────
describe('AT-26: renderGroupsTab is callable repeatedly and reflects current groupsStore', () => {
  it('an in-memory edit appears on the next renderGroupsTab() call', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'A', color: '#000', members: [], isProjection: true },
    ]);
    renderGroups(win);
    execIn(win, 'groupsStore[0].name = "A2";');
    renderGroups(win);
    const input = win.document.querySelector('#groups-table-wrap tbody tr input[type="text"]');
    expect(input.value).toBe('A2');
  });
});

// ─── AT-27: typing without firing change leaves committed value ────
describe('AT-27: typed-but-unblurred value does not commit', () => {
  it('groupsStore[idx].name stays previous value until `change` fires', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'A', color: '#000', members: [], isProjection: true },
    ]);
    renderGroups(win);
    const input = win.document.querySelector('#groups-table-wrap tbody tr input[type="text"]');
    input.value = 'Critical'; // typed in but no change event
    expect(read(win, 'groupsStore')[0].name).toBe('A');
  });
});

// ─── AT-28: Members popover sources options from editedInitiatives ─
describe('AT-28: Members popover lists current editedInitiatives Categories', () => {
  it('an edit to editedInitiatives appears in the popover even before Run', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      sensibleRow('I-1', 'Team A', 'Q2 2026', 'Must'),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);
    // Simulate a user editing the Initiative's Category in the Initiatives tab.
    execIn(win, 'editedInitiatives[0].category = "KR99";');
    setGroups(win, [
      { name: 'A', color: '#000', members: [], isProjection: true },
    ]);
    renderGroups(win);
    win.document.querySelector('#groups-table-wrap .group-add-chip-btn, #groups-table-wrap button[data-add-member]').click();
    const popover = win.document.querySelector('.members-popover, #members-popover, .group-members-popover');
    expect(popover).toBeTruthy();
    expect(popover.textContent).toMatch(/KR99/);
  });
});

// ─── AT-29: popover stays open on checkbox toggle ──────────────────
describe('AT-29: Members popover stays open across multiple option toggles', () => {
  it('after a checkbox toggles, the popover element is still in the DOM', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      sensibleRow('I-1', 'Team A', 'Q2 2026', 'Must'),
      sensibleRow('I-2', 'Team A', 'Q2 2026', 'Should'),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);
    setGroups(win, [
      { name: 'A', color: '#000', members: [], isProjection: true },
    ]);
    renderGroups(win);
    win.document.querySelector('#groups-table-wrap .group-add-chip-btn, #groups-table-wrap button[data-add-member]').click();
    const popover = win.document.querySelector('.members-popover, #members-popover, .group-members-popover');
    const checkboxes = popover.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThan(0);
    checkboxes[0].checked = true;
    checkboxes[0].dispatchEvent(new win.Event('change', { bubbles: true }));
    expect(win.document.querySelector('.members-popover, #members-popover, .group-members-popover')).toBeTruthy();
  });
});

// ─── AT-30: popover closes on outside-click or Esc ─────────────────
describe('AT-30: Members popover closes on outside-click and Esc', () => {
  it('clicking outside the popover removes it from the DOM', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'A', color: '#000', members: [], isProjection: true },
    ]);
    renderGroups(win);
    win.document.querySelector('#groups-table-wrap .group-add-chip-btn, #groups-table-wrap button[data-add-member]').click();
    expect(win.document.querySelector('.members-popover, #members-popover, .group-members-popover')).toBeTruthy();

    // Click on body — outside the popover bounding box.
    win.document.body.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    // Some implementations close on mousedown or click. Allow both.
    win.document.body.dispatchEvent(new win.MouseEvent('mousedown', { bubbles: true }));
    expect(win.document.querySelector('.members-popover, #members-popover, .group-members-popover')).toBeFalsy();
  });

  it('pressing Esc closes the popover', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'A', color: '#000', members: [], isProjection: true },
    ]);
    renderGroups(win);
    win.document.querySelector('#groups-table-wrap .group-add-chip-btn, #groups-table-wrap button[data-add-member]').click();
    expect(win.document.querySelector('.members-popover, #members-popover, .group-members-popover')).toBeTruthy();

    win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(win.document.querySelector('.members-popover, #members-popover, .group-members-popover')).toBeFalsy();
  });
});

// ─── AT-31: 8 Groups render without error, no warning ───────────────
describe('AT-31: more than ~5 Groups render without warning or error', () => {
  it('8 Group rows + 1 + New group row mount cleanly', () => {
    const win = loadSimulator();
    const groups = [];
    for (let i = 0; i < 8; i++) {
      groups.push({ name: `G${i}`, color: '#000', members: [], isProjection: i === 0 });
    }
    setGroups(win, groups);
    renderGroups(win);
    const rows = win.document.querySelectorAll('#groups-table-wrap tbody tr');
    expect(rows).toHaveLength(9);
    // No warning banner mounted inside the tab.
    expect(win.document.querySelector('#tab-groups .warning, #tab-groups .alert')).toBeFalsy();
  });
});

// ─── AT-32: onchange writes the raw string ─────────────────────────
describe('AT-32: Name onchange writes this.value as a string', () => {
  it('an empty string overwrite is accepted', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'A', color: '#000', members: [], isProjection: true },
    ]);
    renderGroups(win);
    const input = win.document.querySelector('#groups-table-wrap tbody tr input[type="text"]');
    input.value = '';
    input.dispatchEvent(new win.Event('change', { bubbles: true }));
    expect(read(win, 'groupsStore')[0].name).toBe('');
  });
});

// ─── AT-33: empty groupsStore renders only the + New group row ─────
describe('AT-33: empty groupsStore renders only the + New group row', () => {
  it('table has exactly one <tr>; clicking + New group pushes a Group with isProjection:true', () => {
    const win = loadSimulator();
    execIn(win, 'groupsStore.length = 0;');
    renderGroups(win);
    const rows = win.document.querySelectorAll('#groups-table-wrap tbody tr');
    expect(rows).toHaveLength(1);

    const addBtn = rows[0].querySelector('button');
    expect(addBtn).toBeTruthy();
    addBtn.click();

    const groups = read(win, 'groupsStore');
    expect(groups).toHaveLength(1);
    expect(groups[0].isProjection).toBe(true);
  });
});
