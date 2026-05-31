// Acceptance tests for feature 0021, Phase 2:
//   Per-Group constant-work shift at the org headline — `fixedEffortPerGroup`
//   replaces the scalar `fixedEffort`; the auto-default `All` Group unions
//   constant-work Categories.
//
// Each `describe('AT-N: …')` block maps to one scenario in
// docs/plans/0021-constant-work-tab-and-group-scoping.md, Phase 2
// "Acceptance behavior".
//
// Behavioral rule under test (ADR-0033 core):
//   The single global constant-work shift becomes a per-**Group** vector. For
//   each Group in the Run snapshot, sum `tshirtToPersonMonths(size)` over
//   `editedConstantWork` rows whose `quarter ∈ targetQuarters` and whose
//   normalised **Category** ∈ `group.members` (compared `trim` +
//   case-insensitively, with the **(Blank) sentinel** matching blank-Category
//   rows), producing `fixedEffortPerGroup: number[]` aligned index-for-index
//   with `kPerGroup`/`groups`. `runSimulation` replaces its scalar `fixedEffort`
//   parameter with `fixedEffortPerGroup`: each Group's sorted distribution is
//   shifted by its own entry; `globalMin = min(fixedEffortPerGroup)`. Constant
//   work contributes ZERO to `kPerGroup`, the **Poisson λ**, and the
//   **Bootstrap pool**. The auto-default `All` Group's members union observed
//   Categories across `editedInitiatives` AND `editedConstantWork` while
//   `groupsStore` is still the pristine auto-default; once the user modifies
//   Groups, no further auto-sync occurs.
//
// Seams targeted (autonomously chosen — see the atdd handover):
//   • The ORG-WIDE per-Group constant-work vector via the plan-named stable
//     seam `prepareSimulationData(hist, target).fixedEffortPerGroup` — NOT a
//     private helper name (the plan leaves the helper name unconstrained).
//   • `runSimulation`'s `fixedEffortPerGroup` parameter + per-Group shift +
//     `globalMin` behaviour + the return reporting `fixedEffortPerGroup`
//     (and NOT the scalar `fixedEffort`).
//   • The auto-default `All` Group via `loadInitiativesCSV` / `loadConstantWorkCSV`
//     and the resulting `groupsStore`.
// These do NOT lock in: whether the vector is a standalone helper or an
// extension of `getConstantWorkEffort`; the pristine-auto-default detection
// mechanism; the exact `globalMax` guard expression.

import { describe, it, expect } from 'vitest';
import { loadSimulator, read, evalIn, execIn, csv } from '../harness.js';

// ─── Fixture helpers ────────────────────────────────────────────────
const INIT_HEADERS = ['jira_key', 'building_block', 'category', 'teams', 'quarter'];
const CW_HEADERS   = ['jira_key', 'epic_name', 'key_result', 'category', 'team', 'quarter', 'tshirt_size'];

function initiativeRow(jiraKey, teams, quarter, category) {
  return { jira_key: jiraKey, building_block: `Init ${jiraKey}`, category, teams, quarter };
}

function loadInitiatives(win, rows, headers = INIT_HEADERS) {
  execIn(win, `loadInitiativesCSV(${JSON.stringify(csv(rows, headers))})`);
}

function loadConstantWork(win, rows, headers = CW_HEADERS) {
  execIn(win, `loadConstantWorkCSV(${JSON.stringify(csv(rows, headers))})`);
}

function setEpics(win, epics) {
  execIn(win, `parsedEpics = ${JSON.stringify(epics)};`);
}

// One epic per initiative key in the historical quarter, size M, so λ and the
// epic sizing pool are non-empty. Constant work must NOT influence these.
function defaultEpics(initKeys, quarter = 'Q1 2026') {
  return initKeys.map((k, i) => ({
    _initiative_key: k, _tshirt_size: 'M', _quarter: quarter, _epic_key: `EPIC-${i + 1}`,
  }));
}

function setGroups(win, groups) {
  execIn(win, `groupsStore.length = 0; for (const g of ${JSON.stringify(groups)}) groupsStore.push(g);`);
}

// Mount constant-work rows directly on the simulation source of truth
// (`editedConstantWork`, the Phase 1 substrate). RowObjects carry whatever
// columns the test needs; the engine reads `category`/`quarter`/`tshirt_size`.
function setConstantWork(win, rows) {
  execIn(win, `editedConstantWork = ${JSON.stringify(rows)};`);
}

// The ORG-WIDE per-Group constant-work vector is reported by
// `prepareSimulationData` (all teams, target quarters) — the plan's stable seam.
function prepare(win, histQuarters, targetQuarters) {
  return evalIn(win, `prepareSimulationData(${JSON.stringify(histQuarters)}, ${JSON.stringify(targetQuarters)})`);
}

function pm(win, size) {
  return evalIn(win, `tshirtToPersonMonths(${JSON.stringify(size)})`);
}

// A minimal initiatives + epics scaffold so prepareSimulationData runs without
// the constant-work rows themselves contributing any Initiative count. The
// scaffold initiative lives in the HISTORICAL quarter with a Category that is
// in no test Group, so `kPerGroup` stays all-zero and the vector is isolated.
function scaffold(win, { groups, constantWork }) {
  loadInitiatives(win, [initiativeRow('I-1', 'Team A', 'Q1 2026', 'ScaffoldCat')]);
  setEpics(win, defaultEpics(['I-1'], 'Q1 2026'));
  setGroups(win, groups);
  if (constantWork) setConstantWork(win, constantWork);
}

// ─── AT-1: a row's effort lifts only Groups whose members include its Category
describe('AT-1: a constant-work row lifts only the Groups whose members include its Category', () => {
  it('credits the matching Group its t-shirt person-months, leaves non-matching Groups at 0, and ignores rows outside the Target quarters', () => {
    const win = loadSimulator();
    scaffold(win, {
      groups: [
        { name: 'Backend',  color: '#a', members: ['Backend'],  isProjection: true },
        { name: 'Frontend', color: '#b', members: ['Frontend'], isProjection: false },
      ],
      constantWork: [
        { category: 'Backend',  quarter: 'Q3 2026', tshirt_size: 'M' },
        // Boundary: a Backend row OUTSIDE the Target quarters must not count.
        { category: 'Backend',  quarter: 'Q4 2026', tshirt_size: 'XL' },
      ],
    });

    const vec = prepare(win, ['Q1 2026'], ['Q3 2026']).fixedEffortPerGroup;
    expect(Array.isArray(vec)).toBe(true);
    expect(vec).toHaveLength(2);
    expect(vec[0]).toBeCloseTo(pm(win, 'M'), 10); // Backend lifted by the Q3 row only
    expect(vec[1]).toBe(0);                        // Frontend untouched
  });
});

// ─── AT-2: a row whose Category is in no Group lifts nothing ─────────
describe('AT-2: a constant-work row whose Category is in no Group lifts nothing', () => {
  it('excludes the row from every Group when its Category matches no members', () => {
    const win = loadSimulator();
    scaffold(win, {
      groups: [{ name: 'Backend', color: '#a', members: ['Backend'], isProjection: true }],
      constantWork: [{ category: 'Ops', quarter: 'Q3 2026', tshirt_size: 'L' }],
    });

    const vec = prepare(win, ['Q1 2026'], ['Q3 2026']).fixedEffortPerGroup;
    expect(vec).toEqual([0]);
  });
});

// ─── AT-3: Category matching is case-insensitive and trimmed ────────
describe('AT-3: per-Group Category matching is case-insensitive and trimmed', () => {
  it('matches " backend " against the member "Backend"', () => {
    const win = loadSimulator();
    scaffold(win, {
      groups: [{ name: 'Backend', color: '#a', members: ['Backend'], isProjection: true }],
      constantWork: [{ category: ' backend ', quarter: 'Q3 2026', tshirt_size: 'S' }],
    });

    const vec = prepare(win, ['Q1 2026'], ['Q3 2026']).fixedEffortPerGroup;
    expect(vec[0]).toBeCloseTo(pm(win, 'S'), 10);
  });
});

// ─── AT-4: a blank-Category row lifts only (Blank) sentinel members ─
describe('AT-4: a blank-Category constant-work row lifts only Groups whose members include the (Blank) sentinel', () => {
  it('credits the BLANK-member Group and leaves a string-member Group at 0', () => {
    const win = loadSimulator();
    const BLANK = read(win, 'BLANK'); // null
    expect(BLANK).toBeNull();
    scaffold(win, {
      groups: [
        { name: 'A', color: '#a', members: [BLANK],     isProjection: true },
        { name: 'B', color: '#b', members: ['Backend'], isProjection: false },
      ],
      constantWork: [{ category: '', quarter: 'Q3 2026', tshirt_size: 'M' }],
    });

    const vec = prepare(win, ['Q1 2026'], ['Q3 2026']).fixedEffortPerGroup;
    expect(vec[0]).toBeCloseTo(pm(win, 'M'), 10); // (Blank)-member Group
    expect(vec[1]).toBe(0);                        // string-member Group
  });
});

// ─── AT-5: runSimulation shifts each Group by its own entry ─────────
describe('AT-5: runSimulation shifts each Group distribution by its own fixedEffortPerGroup entry', () => {
  it('sits each Group flat at its own shift (property over a 0/positive vector) and reports fixedEffortPerGroup, not the scalar fixedEffort', () => {
    const win = loadSimulator();
    const groups = [
      { name: 'A', color: '#a', members: ['Backend'],  isProjection: true },
      { name: 'B', color: '#b', members: ['Frontend'], isProjection: false },
      { name: 'C', color: '#c', members: ['Ops'],      isProjection: false },
    ];
    const shifts = [0, 5, 12]; // boundary 0 + two distinct positive shifts
    const out = evalIn(win, `runSimulation({
      lambda: 1.0, epicSizingDist: ['M'],
      kPerGroup: [0, 0, 0], capacity: 120, iterations: 200,
      fixedEffortPerGroup: ${JSON.stringify(shifts)},
      groups: ${JSON.stringify(groups)},
    })`);

    expect(out.results).toHaveLength(3);
    for (let gi = 0; gi < shifts.length; gi++) {
      const sorted = out.results[gi].sorted;
      expect(sorted).toHaveLength(200);
      for (let i = 0; i < sorted.length; i++) expect(sorted[i]).toBe(shifts[gi]);
      expect(out.results[gi].stats.p50).toBe(shifts[gi]);
    }

    // Contract: the scalar `fixedEffort` is gone; the vector is reported.
    expect(out).toHaveProperty('fixedEffortPerGroup');
    expect(out.fixedEffortPerGroup).toEqual(shifts);
    expect(out).not.toHaveProperty('fixedEffort');
  });
});

// ─── AT-6: the shared Global histogram range floor is the minimum shift
describe('AT-6: the shared Global histogram range floor (globalMin) is the minimum per-Group shift', () => {
  it('sets globalMin === min(fixedEffortPerGroup) across several vectors and keeps bins shared', () => {
    const win = loadSimulator();
    const groups = [
      { name: 'A', color: '#a', members: ['Backend'],  isProjection: true },
      { name: 'B', color: '#b', members: ['Frontend'], isProjection: false },
    ];
    // Property: globalMin tracks the minimum entry — not the first, the max, or
    // a single shared scalar. Includes a 0-floor boundary and a non-zero floor.
    for (const vec of [[0, 8], [3, 8], [8, 3], [5, 5]]) {
      const out = evalIn(win, `runSimulation({
        lambda: 1.0, epicSizingDist: ['M', 'M'],
        kPerGroup: [3, 4], capacity: 120, iterations: 500,
        fixedEffortPerGroup: ${JSON.stringify(vec)},
        groups: ${JSON.stringify(groups)},
      })`);
      expect(out.globalMin).toBe(Math.min(...vec));
      expect(out.results[0].hist.binCenters).toEqual(out.results[1].hist.binCenters);
    }
  });
});

// ─── AT-7: constant work does not change K, λ, or the bootstrap pool ─
describe('AT-7: constant work changes only fixedEffortPerGroup — never kPerGroup, λ, or the epic sizing pool', () => {
  it('keeps kPerGroup, lambda and epicSizingDist identical with and without a constant-work row', () => {
    const win = loadSimulator();
    // A real target-quarter initiative so kPerGroup is non-trivial.
    loadInitiatives(win, [
      initiativeRow('I-1', 'Team A', 'Q1 2026', 'Backend'), // historical
      initiativeRow('I-2', 'Team A', 'Q3 2026', 'Backend'), // target
    ]);
    setEpics(win, defaultEpics(['I-1', 'I-2'], 'Q1 2026'));
    setGroups(win, [{ name: 'Backend', color: '#a', members: ['Backend'], isProjection: true }]);

    const without = prepare(win, ['Q1 2026'], ['Q3 2026']);
    setConstantWork(win, [{ category: 'Backend', quarter: 'Q3 2026', tshirt_size: 'M' }]);
    const wit = prepare(win, ['Q1 2026'], ['Q3 2026']);

    // Invariant: constant work is purely additive deterministic effort.
    expect(wit.kPerGroup).toEqual(without.kPerGroup);
    expect(wit.lambda).toBe(without.lambda);
    expect(wit.epicSizingDist).toEqual(without.epicSizingDist);

    // The only thing that moves is the per-Group constant-work vector.
    expect(without.fixedEffortPerGroup).toEqual([0]);
    expect(wit.fixedEffortPerGroup[0]).toBeCloseTo(pm(win, 'M'), 10);
  });
});

// ─── AT-8: a Category in multiple Groups lifts each of them (overlap) ─
describe('AT-8: a constant-work Category present in multiple Groups lifts each of them', () => {
  it('credits every Group whose members include the overlapping Category', () => {
    const win = loadSimulator();
    scaffold(win, {
      groups: [
        { name: 'A', color: '#a', members: ['Backend', 'Shared'], isProjection: true },
        { name: 'B', color: '#b', members: ['Shared'],            isProjection: false },
      ],
      constantWork: [{ category: 'Shared', quarter: 'Q3 2026', tshirt_size: 'M' }],
    });

    const vec = prepare(win, ['Q1 2026'], ['Q3 2026']).fixedEffortPerGroup;
    expect(vec[0]).toBeCloseTo(pm(win, 'M'), 10);
    expect(vec[1]).toBeCloseTo(pm(win, 'M'), 10);
  });
});

// ─── AT-9: the auto-default All Group unions both sources (load-order free)
describe('AT-9: the auto-default All Group members union initiative and constant-work Categories (load-order independent)', () => {
  function assertUnion(win) {
    const groups = read(win, 'groupsStore');
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('All');
    const members = new Set(groups[0].members);
    for (const cat of ['Analytics', 'Backend', 'Compliance']) {
      expect(members.has(cat)).toBe(true);
    }
  }

  it('unions {Analytics,Backend} (initiatives) with {Compliance} (constant work) when initiatives load first', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      initiativeRow('I-1', 'Team A', 'Q2 2026', 'Analytics'),
      initiativeRow('I-2', 'Team A', 'Q2 2026', 'Backend'),
    ]);
    loadConstantWork(win, [
      { jira_key: 'CW-1', epic_name: 'X', key_result: '', category: 'Compliance', team: 'Team A', quarter: 'Q3 2026', tshirt_size: 'M' },
    ]);
    assertUnion(win);
  });

  it('unions the same Categories when constant work loads first', () => {
    const win = loadSimulator();
    loadConstantWork(win, [
      { jira_key: 'CW-1', epic_name: 'X', key_result: '', category: 'Compliance', team: 'Team A', quarter: 'Q3 2026', tshirt_size: 'M' },
    ]);
    loadInitiatives(win, [
      initiativeRow('I-1', 'Team A', 'Q2 2026', 'Analytics'),
      initiativeRow('I-2', 'Team A', 'Q2 2026', 'Backend'),
    ]);
    assertUnion(win);
  });
});

// ─── AT-10: the auto-default stops syncing once the user modifies Groups
describe('AT-10: the auto-default stops auto-syncing once the user has modified Groups', () => {
  it('leaves user-defined Groups untouched when a later Constant Work CSV introduces a new Category', () => {
    const win = loadSimulator();
    loadInitiatives(win, [initiativeRow('I-1', 'Team A', 'Q2 2026', 'Analytics')]);

    // The user replaces the auto-default with their own Groups (any modification
    // freezes auto-sync — detection mechanism is the implementer's choice).
    setGroups(win, [
      { name: 'KR1', color: '#ea7c2c', members: ['KR1'], isProjection: true },
      { name: 'KR2', color: '#059669', members: ['KR2'], isProjection: false },
    ]);

    loadConstantWork(win, [
      { jira_key: 'CW-1', epic_name: 'X', key_result: '', category: 'BrandNewCat', team: 'Team A', quarter: 'Q3 2026', tshirt_size: 'M' },
    ]);

    const after = read(win, 'groupsStore');
    expect(after.map(g => g.name)).toEqual(['KR1', 'KR2']);
    expect(after[0].members).toEqual(['KR1']);
    expect(after[1].members).toEqual(['KR2']);
    // The constant-work-only Category was NOT auto-added anywhere.
    for (const g of after) expect(g.members).not.toContain('BrandNewCat');
  });
});

// ─── AT-11: totalK === 0 + constant work → each Group flat at its shift ─
describe('AT-11: a Run with totalK === 0 but constant work present sits each Group at its own per-Group shift', () => {
  it('produces a flat per-Group distribution at each Group constant-work person-months (pure constant work)', () => {
    const win = loadSimulator();
    // No target-quarter initiatives → kPerGroup is all-zero.
    loadInitiatives(win, [initiativeRow('I-1', 'Team A', 'Q1 2026', 'ScaffoldCat')]);
    setEpics(win, defaultEpics(['I-1'], 'Q1 2026'));
    const groups = [
      { name: 'Backend',  color: '#a', members: ['Backend'],  isProjection: true },
      { name: 'Frontend', color: '#b', members: ['Frontend'], isProjection: false },
    ];
    setGroups(win, groups);
    setConstantWork(win, [
      { category: 'Backend',  quarter: 'Q3 2026', tshirt_size: 'M' },
      { category: 'Frontend', quarter: 'Q3 2026', tshirt_size: 'L' },
    ]);

    const data = prepare(win, ['Q1 2026'], ['Q3 2026']);
    expect(data.kPerGroup).toEqual([0, 0]); // totalK === 0

    const out = evalIn(win, `runSimulation({
      lambda: ${data.lambda},
      epicSizingDist: ${JSON.stringify(data.epicSizingDist)},
      kPerGroup: ${JSON.stringify(data.kPerGroup)},
      fixedEffortPerGroup: ${JSON.stringify(data.fixedEffortPerGroup)},
      capacity: 120, iterations: 200,
      groups: ${JSON.stringify(groups)},
    })`);

    const expectBackend  = pm(win, 'M');
    const expectFrontend = pm(win, 'L');
    const back = out.results[0].sorted;
    const front = out.results[1].sorted;
    for (let i = 0; i < back.length; i++) expect(back[i]).toBeCloseTo(expectBackend, 10);
    for (let i = 0; i < front.length; i++) expect(front[i]).toBeCloseTo(expectFrontend, 10);
    // Flat band: zero variance, each Group sits exactly at its own shift.
    expect(out.results[0].stats.p10).toBeCloseTo(expectBackend, 10);
    expect(out.results[0].stats.p90).toBeCloseTo(expectBackend, 10);
    expect(out.results[1].stats.p10).toBeCloseTo(expectFrontend, 10);
    expect(out.results[1].stats.p90).toBeCloseTo(expectFrontend, 10);
  });
});
