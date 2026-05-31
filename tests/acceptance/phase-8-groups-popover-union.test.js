// Acceptance tests for feature 0021, Phase 8:
//   "Groups Members popover lists initiatives ∪ constant-work Categories (merge)".
//
// Each `describe('AT-N: …')` block maps to one scenario in
// docs/plans/0021-constant-work-tab-and-group-scoping.md, Phase 8
// "Acceptance behavior".
//
// Behavioral rule under test: the Groups **Members** popover's observed-Categories
// list sources from the union of Categories across `editedInitiatives` AND
// `editedConstantWork`, computed at popover-open time. A Category present in both
// sources is a single entry; the Initiative's casing wins on a merge; a
// constant-work-only Category keeps its own casing; the union dedups
// case-insensitively. The `(Blank)` row and the free-text input are unchanged
// (feature 0020). Adding a constant-work-only Category to a Group is how the user
// targets that constant work, which then scopes it per Phases 2-4.
//
// Seams targeted (autonomously chosen — see the handover):
//   • The Members popover open affordance (`+` button → `.group-add-chip-btn`),
//     mirroring the feature-0020 Phase-2 popover tests. The exact popover DOM is
//     NOT locked beyond the option-list contents and the `(Blank)`/free-text
//     affordances (the plan forbids locking it further).
//   • The option list read from the DOM (`.ms-option` labels / checkbox values).
//   • The Phase-2 engine seam `getConstantWorkEffortPerGroup` and the Phase-5
//     `getConstantWorkExcluded` seam for AT-4's "scopes on the next Run" effect.
//   • Constant work uses the `category` key (the canonical constant-work schema),
//     consistent with `getConstantWorkEffortPerGroup` / the auto-default union.

import { describe, it, expect } from 'vitest';
import { loadSimulator, read, evalIn, execIn, csv } from '../harness.js';

// ─── Fixture helpers ────────────────────────────────────────────────

function loadInitiatives(win, rows, headers) {
  const text = csv(rows, headers);
  execIn(win, `loadInitiativesCSV(${JSON.stringify(text)})`);
}

function initiativeRow(jiraKey, category, teams = 'Team A', quarter = 'Q3 2026') {
  return { jira_key: jiraKey, name: `Init ${jiraKey}`, category, teams, quarter };
}

const INIT_HEADERS = ['jira_key', 'name', 'category', 'teams', 'quarter'];

function setConstantWork(win, rows) {
  // editedConstantWork is a `let`; reassign it in the page realm (the established
  // idiom — see the Phase 2-7 constant-work tests). This mirrors a loaded /
  // edited Constant Work model without invoking the auto-default-group sync, so
  // groupsStore stays exactly what the test sets.
  execIn(win, `editedConstantWork = ${JSON.stringify(rows)};`);
}

function setGroups(win, groups) {
  execIn(win, `groupsStore.length = 0; for (const g of ${JSON.stringify(groups)}) groupsStore.push(g);`);
}

function renderGroups(win) {
  execIn(win, 'renderGroupsTab();');
}

function openPopover(win) {
  const addBtn = win.document.querySelector(
    '#groups-table-wrap .group-add-chip-btn, #groups-table-wrap button[data-add-member]'
  );
  expect(addBtn).toBeTruthy();
  addBtn.click();
  const popover = win.document.querySelector(
    '.members-popover, #members-popover, .group-members-popover'
  );
  expect(popover).toBeTruthy();
  return popover;
}

// The Category options the popover offers (the union), excluding the dedicated
// `(Blank)` row and the free-text add-row. Reads option text the same way the
// feature-0020 Phase-2 popover tests do (`.ms-option` / `label`), so this is not
// coupled to anything beyond "the option-list contents".
function categoryOptions(popover) {
  const labels = Array.from(popover.querySelectorAll('.ms-option, label'));
  return labels
    .filter((l) => !l.querySelector('input[data-blank]')) // drop the (Blank) row
    .map((l) => l.textContent.trim())
    .filter((t) => t.length);
}

// ─── AT-1: the popover lists a constant-work-only Category ──────────
describe('AT-1: the Members popover lists a constant-work-only Category alongside initiative Categories', () => {
  it('lists every initiative Category and every constant-work-only Category', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      initiativeRow('I-1', 'A'),
      initiativeRow('I-2', 'B'),
    ], INIT_HEADERS);
    setConstantWork(win, [
      { jira_key: 'C-1', epic_name: 'CW 1', key_result: '', category: 'C', team: 'Team A', quarter: 'Q3 2026', tshirt_size: 'M' },
    ]);
    setGroups(win, [{ name: 'G', color: '#000', members: [], isProjection: true }]);
    renderGroups(win);

    const opts = categoryOptions(openPopover(win));
    expect(opts).toContain('A');
    expect(opts).toContain('B');
    expect(opts).toContain('C'); // the constant-work-only Category
  });

  it('does not list a Category that is in neither initiatives nor constant work (negative)', () => {
    const win = loadSimulator();
    loadInitiatives(win, [initiativeRow('I-1', 'A')], INIT_HEADERS);
    setConstantWork(win, [
      { category: 'C', team: 'Team A', quarter: 'Q3 2026', tshirt_size: 'M' },
    ]);
    setGroups(win, [{ name: 'G', color: '#000', members: [], isProjection: true }]);
    renderGroups(win);

    const opts = categoryOptions(openPopover(win));
    expect(opts.some((o) => /Zlogistics/i.test(o))).toBe(false);
  });

  it('lists every distinct constant-work Category (property over a multi-row, multi-Category model)', () => {
    const win = loadSimulator();
    loadInitiatives(win, [initiativeRow('I-1', 'A')], INIT_HEADERS);
    const cwCats = ['Platform', 'Data', 'Security'];
    setConstantWork(win, cwCats.map((c, i) => ({
      category: c, team: 'Team A', quarter: 'Q3 2026', tshirt_size: 'S', jira_key: `C-${i}`,
    })));
    setGroups(win, [{ name: 'G', color: '#000', members: [], isProjection: true }]);
    renderGroups(win);

    const opts = categoryOptions(openPopover(win));
    for (const c of cwCats) expect(opts).toContain(c);
  });
});

// ─── AT-2: a Category in both sources is merged (Initiative casing wins) ──
describe('AT-2: a Category present in both sources appears once, with the Initiative casing', () => {
  it('a single merged entry uses the Initiative casing, not the constant-work casing', () => {
    const win = loadSimulator();
    loadInitiatives(win, [initiativeRow('I-1', 'Backend')], INIT_HEADERS);
    setConstantWork(win, [
      { category: 'backend', team: 'Team A', quarter: 'Q3 2026', tshirt_size: 'M' },
    ]);
    setGroups(win, [{ name: 'G', color: '#000', members: [], isProjection: true }]);
    renderGroups(win);

    const opts = categoryOptions(openPopover(win));
    const backendEntries = opts.filter((o) => o.toLowerCase() === 'backend');
    expect(backendEntries).toHaveLength(1); // dedup: one entry, not two
    expect(backendEntries[0]).toBe('Backend'); // Initiative casing wins
  });

  it('dedups case-insensitively across several overlapping case variants (property)', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      initiativeRow('I-1', 'Backend'),
      initiativeRow('I-2', 'Frontend'),
    ], INIT_HEADERS);
    setConstantWork(win, [
      { category: 'BACKEND', team: 'Team A', quarter: 'Q3 2026', tshirt_size: 'M', jira_key: 'C-1' },
      { category: ' frontend ', team: 'Team A', quarter: 'Q3 2026', tshirt_size: 'M', jira_key: 'C-2' },
    ]);
    setGroups(win, [{ name: 'G', color: '#000', members: [], isProjection: true }]);
    renderGroups(win);

    const opts = categoryOptions(openPopover(win));
    expect(opts.filter((o) => o.toLowerCase() === 'backend')).toEqual(['Backend']);
    expect(opts.filter((o) => o.toLowerCase() === 'frontend')).toEqual(['Frontend']);
  });
});

// ─── AT-3: a constant-work-only Category keeps its own casing ──────
describe('AT-3: a constant-work-only Category keeps its own casing', () => {
  it('renders the constant-work casing verbatim when the Category is absent from initiatives', () => {
    const win = loadSimulator();
    loadInitiatives(win, [initiativeRow('I-1', 'Backend')], INIT_HEADERS);
    setConstantWork(win, [
      { category: 'Ops', team: 'Team A', quarter: 'Q3 2026', tshirt_size: 'M' },
    ]);
    setGroups(win, [{ name: 'G', color: '#000', members: [], isProjection: true }]);
    renderGroups(win);

    const opts = categoryOptions(openPopover(win));
    expect(opts).toContain('Ops'); // its own casing, not 'ops' / 'OPS'
    expect(opts).not.toContain('ops');
    expect(opts).not.toContain('OPS');
  });

  it('preserves a mixed-case constant-work-only Category exactly (boundary)', () => {
    const win = loadSimulator();
    loadInitiatives(win, [initiativeRow('I-1', 'Backend')], INIT_HEADERS);
    setConstantWork(win, [
      { category: 'DataPlatform', team: 'Team A', quarter: 'Q3 2026', tshirt_size: 'M' },
    ]);
    setGroups(win, [{ name: 'G', color: '#000', members: [], isProjection: true }]);
    renderGroups(win);

    const opts = categoryOptions(openPopover(win));
    expect(opts).toContain('DataPlatform');
  });
});

// ─── AT-4: adding a constant-work-only Category scopes that work on the next Run ──
describe('AT-4: adding a constant-work-only Category to a Group scopes that constant work on the next Run', () => {
  it('after adding the Category via the popover, the Group\'s fixedEffortPerGroup includes the row PM and the row is no longer excluded', () => {
    const win = loadSimulator();
    loadInitiatives(win, [initiativeRow('I-1', 'Backend')], INIT_HEADERS);
    setConstantWork(win, [
      { category: 'Ops', team: 'Team A', quarter: 'Q3 2026', tshirt_size: 'M' },
    ]);
    setGroups(win, [{ name: 'A', color: '#000', members: ['Backend'], isProjection: true }]);
    renderGroups(win);

    const expectedPM = evalIn(win, "tshirtToPersonMonths('M')");
    expect(expectedPM).toBeGreaterThan(0);

    // Negative baseline: Ops is in no Group → no shift, surfaced as excluded.
    expect(evalIn(win, "getConstantWorkEffortPerGroup(['Q3 2026'], groupsStore)")[0]).toBe(0);
    expect(evalIn(win, "getConstantWorkExcluded(['Q3 2026'], groupsStore)")).toMatchObject({ rows: 1 });

    // The user targets the constant work by adding its Category via the popover —
    // the Ops checkbox exists ONLY because the popover now sources the union.
    const popover = openPopover(win);
    const opsCheckbox = Array.from(popover.querySelectorAll('input[type="checkbox"]')).find((cb) => {
      const label = cb.closest('label') || cb.parentElement;
      return label && /\bOps\b/.test(label.textContent);
    });
    expect(opsCheckbox).toBeTruthy();
    opsCheckbox.checked = true;
    opsCheckbox.dispatchEvent(new win.Event('change', { bubbles: true }));

    // The Category is now a member of Group A.
    expect(read(win, 'groupsStore')[0].members.map((m) => String(m).toLowerCase())).toContain('ops');

    // On the next Run the work is scoped to Group A and no longer excluded.
    expect(evalIn(win, "getConstantWorkEffortPerGroup(['Q3 2026'], groupsStore)")[0]).toBe(expectedPM);
    expect(evalIn(win, "getConstantWorkExcluded(['Q3 2026'], groupsStore)")).toMatchObject({ pm: 0, rows: 0 });
  });
});

// ─── AT-5: the (Blank) row and the free-text input are still present ──
describe('AT-5: the popover still lists the (Blank) row and the free-text input', () => {
  it('a dedicated (Blank) row and a free-text input are present (unchanged from feature 0020)', () => {
    const win = loadSimulator();
    loadInitiatives(win, [initiativeRow('I-1', 'A')], INIT_HEADERS);
    setConstantWork(win, [
      { category: 'C', team: 'Team A', quarter: 'Q3 2026', tshirt_size: 'M' },
    ]);
    setGroups(win, [{ name: 'G', color: '#000', members: [], isProjection: true }]);
    renderGroups(win);

    const popover = openPopover(win);
    // Dedicated (Blank) row.
    const blankCheckbox = popover.querySelector('input[type="checkbox"][data-blank]');
    expect(blankCheckbox).toBeTruthy();
    expect(popover.textContent).toMatch(/\(Blank\)/);
    // Free-text input.
    expect(popover.querySelector('input[type="text"]')).toBeTruthy();
  });
});

// ─── AT-6: the union reflects the current edited state, computed at open time ──
describe('AT-6: the union reflects the current edited state of both tabs (computed at open time)', () => {
  it('an unsaved edit to an initiative Category and to a constant-work Category both appear without a Run', () => {
    const win = loadSimulator();
    loadInitiatives(win, [initiativeRow('I-1', 'A')], INIT_HEADERS);
    setConstantWork(win, [
      { category: 'C', team: 'Team A', quarter: 'Q3 2026', tshirt_size: 'M' },
    ]);
    setGroups(win, [{ name: 'G', color: '#000', members: [], isProjection: true }]);
    renderGroups(win);

    // Edit both edited models in place (as the tabs' onchange handlers do), no Run.
    execIn(win, 'editedInitiatives[0].category = "KR9";');
    execIn(win, 'editedConstantWork[0].category = "KR8";');

    const opts = categoryOptions(openPopover(win));
    expect(opts).toContain('KR9'); // edited initiative Category
    expect(opts).toContain('KR8'); // edited constant-work Category
  });

  it('recomputes on each open, so an edit made after a first open is reflected on reopen (not cached)', () => {
    const win = loadSimulator();
    loadInitiatives(win, [initiativeRow('I-1', 'A')], INIT_HEADERS);
    setConstantWork(win, [
      { category: 'C', team: 'Team A', quarter: 'Q3 2026', tshirt_size: 'M' },
    ]);
    setGroups(win, [{ name: 'G', color: '#000', members: [], isProjection: true }]);
    renderGroups(win);

    // First open establishes the popover once.
    let opts = categoryOptions(openPopover(win));
    expect(opts).toContain('C');
    expect(opts).not.toContain('LateAddition');

    // Edit the constant-work model, then reopen — the new Category must appear.
    execIn(win, 'editedConstantWork[0].category = "LateAddition";');
    opts = categoryOptions(openPopover(win));
    expect(opts).toContain('LateAddition');
    expect(opts).not.toContain('C'); // the old value is gone (recomputed, not cached)
  });
});
