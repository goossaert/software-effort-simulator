// Acceptance tests for feature 0021, Phase 4:
//   Team Projections surface honors Category-scoping — on the **Team Projections
//   tab**, each (team, quarter) cell scopes its **Constant work** to the
//   **Projection group**'s members. The appended constant-work **Initiative
//   matrix** rows and the `cwEffort` **Effort projection band** floor include
//   only constant-work rows (for that team, that quarter) whose **Category** ∈
//   `projGroup.members` (trim + case-fold; the **(Blank) sentinel** matches
//   blank-Category rows). The single-group projection `runSimulation` call passes
//   `fixedEffortPerGroup: [scopedCwEffort]`.
//
// Degenerate fallback (ADR-0023): when **no** Projection group exists (or
// `groupsStore` is empty), the cell falls back to the constant-work-only flat
// band using **all** constant work for that (team, quarter). Category-scoping
// applies only when a Projection group exists.
//
// Each `describe('AT-N: …')` block maps to one scenario in
// docs/plans/0021-constant-work-tab-and-group-scoping.md, Phase 4
// "Acceptance behavior".
//
// Seams targeted (autonomously chosen — see the atdd handover):
//   • `buildTeamProjections(allQuarters, orgLambda, orgEpicSizingDist,
//     projIterations)` — the plan-named stable entry point. The cell is read at
//     `proj[i].byQuarter[q]`; the contract under test is the cell's `cwEffort`
//     (scoped band floor), the cell's flat **Effort projection band**
//     (`p25/p50/p75`), and the cell's appended constant-work **Initiative
//     matrix** rows (`cell.initiatives.filter(e => e.isConstant)`).
//   • These do NOT lock in whether the scoping reuses the Phase 2 vector helper
//     (with `[projGroup]` as `groups`) or filters `getConstantWorkEpics`' output
//     inline — the contract is the scoped `cwEffort` and scoped matrix rows.
//
// To keep the **Effort projection band** deterministic, every fixture below
// gives its initiative a **Category** that is in NO Projection-group member, so
// the projection K (`kProj`) is 0 and the band collapses to the flat
// `(cwEffort, cwEffort, cwEffort)` triple — no Monte Carlo is invoked, and the
// scoped `cwEffort` is directly observable in the band.

import { describe, it, expect } from 'vitest';
import { loadSimulator, evalIn, execIn, csv } from '../harness.js';

// ─── Fixture helpers ────────────────────────────────────────────────
const INIT_HEADERS = ['jira_key', 'building_block', 'category', 'teams', 'quarter'];

function initiativeRow(jiraKey, team, quarter, category) {
  return { jira_key: jiraKey, building_block: `Init ${jiraKey}`, category, teams: team, quarter };
}

function loadInitiatives(win, rows, headers = INIT_HEADERS) {
  execIn(win, `loadInitiativesCSV(${JSON.stringify(csv(rows, headers))})`);
}

// `buildTeamProjections` does not read `parsedEpics` (it only invokes the Monte
// Carlo engine when the Projection group's K > 0, which these fixtures avoid),
// but we keep the page state non-null for parity with the other engine tests.
function setEpics(win, epics) {
  execIn(win, `parsedEpics = ${JSON.stringify(epics)};`);
}

// Replace `groupsStore` wholesale (a literal `[]` clears it). Done AFTER
// `loadInitiativesCSV` so the auto-default `All` Group created at load time is
// overwritten by the exact Group snapshot under test. `BLANK` is the JS `null`
// literal, which JSON-serialises verbatim — so `members: [null]` round-trips as
// `[BLANK]`.
function setGroups(win, groups) {
  execIn(win, `groupsStore.length = 0; for (const g of ${JSON.stringify(groups)}) groupsStore.push(g);`);
}

// Mount constant-work rows directly on the simulation source of truth
// (`editedConstantWork`, the Phase 1 substrate). `getConstantWorkEpics` reads
// `team`/`quarter` for selection and `category`/`tshirt_size` for the matrix row.
function setConstantWork(win, rows) {
  execIn(win, `editedConstantWork = ${JSON.stringify(rows)};`);
}

function pm(win, size) {
  return evalIn(win, `tshirtToPersonMonths(${JSON.stringify(size)})`);
}

function buildProjections(win, allQuarters, orgLambda = 1.0, orgEpicSizingDist = ['M'], projIterations = 200) {
  return evalIn(
    win,
    `buildTeamProjections(${JSON.stringify(allQuarters)}, ${orgLambda}, ${JSON.stringify(orgEpicSizingDist)}, ${projIterations})`
  );
}

function cellFor(proj, teamName, quarter) {
  const team = proj.find(t => t.teamName.toLowerCase() === teamName.toLowerCase());
  return team ? team.byQuarter[quarter] : undefined;
}

// The cell's appended constant-work **Initiative matrix** rows: getConstantWorkEpics
// labels each with `isConstant: true`.
function constantWorkMatrixRows(cell) {
  return (cell.initiatives || []).filter(e => e.isConstant);
}

// ─── AT-1: matrix rows scoped to the Projection group's members ─────
describe("AT-1: a projection cell shows only constant work whose Category is in the Projection group's members", () => {
  it("appends the Backend constant-work row to the cell and omits the Ops row when the Projection group's members are ['Backend']", () => {
    const win = loadSimulator();
    // Initiative Category is in no Group → projection K is 0 → flat band.
    loadInitiatives(win, [initiativeRow('I-1', 'Platform', 'Q3 2026', 'ScaffoldCat')]);
    setEpics(win, []);
    setGroups(win, [{ name: 'Backend', color: '#a', members: ['Backend'], isProjection: true }]);
    setConstantWork(win, [
      { jira_key: 'CW-BE',  epic_name: 'Backend CW', team: 'Platform', category: 'Backend', quarter: 'Q3 2026', tshirt_size: 'M' },
      { jira_key: 'CW-OPS', epic_name: 'Ops CW',     team: 'Platform', category: 'Ops',     quarter: 'Q3 2026', tshirt_size: 'L' },
    ]);

    const cell = cellFor(buildProjections(win, ['Q3 2026']), 'Platform', 'Q3 2026');
    expect(cell).toBeTruthy();

    const cwRows = constantWorkMatrixRows(cell);
    expect(cwRows).toHaveLength(1);
    expect(cwRows[0].category).toBe('Backend');
    // Negative: the Ops row, whose Category is in no member of the Projection
    // group, must not appear in the cell.
    expect(cwRows.some(e => e.category === 'Ops')).toBe(false);
  });
});

// ─── AT-2: cwEffort band floor scoped to the Projection group's members ──
describe("AT-2: a projection cell's cwEffort band floor is scoped to the Projection group's members", () => {
  it("sets cwEffort to the Backend row's person-months only, not the Backend+Ops total, and flattens the band to that scoped floor", () => {
    const win = loadSimulator();
    loadInitiatives(win, [initiativeRow('I-1', 'Platform', 'Q3 2026', 'ScaffoldCat')]);
    setEpics(win, []);
    setGroups(win, [{ name: 'Backend', color: '#a', members: ['Backend'], isProjection: true }]);
    setConstantWork(win, [
      { team: 'Platform', category: 'Backend', quarter: 'Q3 2026', tshirt_size: 'M' },
      { team: 'Platform', category: 'Ops',     quarter: 'Q3 2026', tshirt_size: 'L' },
    ]);

    const cell = cellFor(buildProjections(win, ['Q3 2026']), 'Platform', 'Q3 2026');
    expect(cell).toBeTruthy();
    // Scoped to the Backend row alone …
    expect(cell.cwEffort).toBeCloseTo(pm(win, 'M'), 10);
    // … explicitly NOT the unscoped Backend+Ops total.
    expect(cell.cwEffort).not.toBeCloseTo(pm(win, 'M') + pm(win, 'L'), 10);
    // The Effort projection band is the flat triple at the scoped floor (kProj === 0).
    expect(cell.p25).toBe(cell.cwEffort);
    expect(cell.p50).toBe(cell.cwEffort);
    expect(cell.p75).toBe(cell.cwEffort);
  });

  // Property/boundary: the Category membership match reuses the org/team
  // semantics — trim + case-fold (ADR-0028). A row whose Category differs from a
  // member only by surrounding whitespace and letter case is still in scope.
  it("scopes by Category case-insensitively and after trimming surrounding whitespace", () => {
    const win = loadSimulator();
    loadInitiatives(win, [initiativeRow('I-1', 'Platform', 'Q3 2026', 'ScaffoldCat')]);
    setEpics(win, []);
    setGroups(win, [{ name: 'Backend', color: '#a', members: ['Backend'], isProjection: true }]);
    setConstantWork(win, [
      { team: 'Platform', category: '  backend ', quarter: 'Q3 2026', tshirt_size: 'M' }, // matches 'Backend'
      { team: 'Platform', category: 'OPS',        quarter: 'Q3 2026', tshirt_size: 'L' }, // in no member → excluded
    ]);

    const cell = cellFor(buildProjections(win, ['Q3 2026']), 'Platform', 'Q3 2026');
    expect(cell).toBeTruthy();
    expect(cell.cwEffort).toBeCloseTo(pm(win, 'M'), 10);
    expect(constantWorkMatrixRows(cell)).toHaveLength(1);
  });
});

// ─── AT-3: zero-member Projection group collapses the band to a scoped 0 ──
describe('AT-3: a zero-member Projection group collapses the band to a scoped cwEffort of 0', () => {
  it('scopes cwEffort to 0 and flattens the Effort projection band to (0, 0, 0) even when the cell has constant work', () => {
    const win = loadSimulator();
    loadInitiatives(win, [initiativeRow('I-1', 'Platform', 'Q3 2026', 'ScaffoldCat')]);
    setEpics(win, []);
    // Boundary: a Projection group with NO members — every Category is out of scope.
    setGroups(win, [{ name: 'Empty', color: '#a', members: [], isProjection: true }]);
    setConstantWork(win, [
      { team: 'Platform', category: 'Backend', quarter: 'Q3 2026', tshirt_size: 'M' },
    ]);

    const cell = cellFor(buildProjections(win, ['Q3 2026']), 'Platform', 'Q3 2026');
    expect(cell).toBeTruthy();
    expect(cell.cwEffort).toBe(0);
    expect(cell.p25).toBe(0);
    expect(cell.p50).toBe(0);
    expect(cell.p75).toBe(0);
    // The scoped-out constant work also disappears from the cell's matrix rows.
    expect(constantWorkMatrixRows(cell)).toHaveLength(0);
  });
});

// ─── AT-4: degenerate fallback — empty groupsStore uses all constant work ──
describe('AT-4: with no Projection group (empty groupsStore) the cell falls back to all constant work for that (team, quarter)', () => {
  it('sums every constant-work row into cwEffort, flattens the band to that total, and keeps all rows in the matrix (ADR-0023 degenerate fallback)', () => {
    const win = loadSimulator();
    loadInitiatives(win, [initiativeRow('I-1', 'Platform', 'Q3 2026', 'ScaffoldCat')]);
    setEpics(win, []);
    setGroups(win, []); // no Groups at all → no Projection group → degenerate fallback
    setConstantWork(win, [
      { team: 'Platform', category: 'Backend', quarter: 'Q3 2026', tshirt_size: 'M' },
      { team: 'Platform', category: 'Ops',     quarter: 'Q3 2026', tshirt_size: 'L' },
    ]);

    const expectedTotal = pm(win, 'M') + pm(win, 'L');
    const cell = cellFor(buildProjections(win, ['Q3 2026']), 'Platform', 'Q3 2026');
    expect(cell).toBeTruthy();
    // All constant work counts when there is no Projection group to scope by.
    expect(cell.cwEffort).toBeCloseTo(expectedTotal, 10);
    expect(cell.p25).toBe(cell.cwEffort);
    expect(cell.p50).toBe(cell.cwEffort);
    expect(cell.p75).toBe(cell.cwEffort);
    // Nothing is scoped out of the matrix in the degenerate case.
    expect(constantWorkMatrixRows(cell)).toHaveLength(2);
  });
});

// ─── AT-5: a (Blank) sentinel member includes blank-Category constant work ──
describe("AT-5: a Projection group whose members include the (Blank) sentinel includes blank-Category constant work in the cell", () => {
  it("scopes cwEffort to the blank-Category row and excludes a non-blank-Category row when members === [BLANK]", () => {
    const win = loadSimulator();
    loadInitiatives(win, [initiativeRow('I-1', 'Platform', 'Q3 2026', 'ScaffoldCat')]);
    setEpics(win, []);
    // BLANK is the JS `null` literal — `members: [null]` is `members: [BLANK]`.
    setGroups(win, [{ name: 'Unlabelled', color: '#a', members: [null], isProjection: true }]);
    setConstantWork(win, [
      { team: 'Platform', category: '',        quarter: 'Q3 2026', tshirt_size: 'M' }, // blank Category → in scope
      { team: 'Platform', category: 'Backend', quarter: 'Q3 2026', tshirt_size: 'L' }, // non-blank → excluded
    ]);

    const cell = cellFor(buildProjections(win, ['Q3 2026']), 'Platform', 'Q3 2026');
    expect(cell).toBeTruthy();
    expect(cell.cwEffort).toBeCloseTo(pm(win, 'M'), 10);

    const cwRows = constantWorkMatrixRows(cell);
    expect(cwRows).toHaveLength(1);
    // normalizeCategory('') === BLANK (the JS `null` sentinel).
    expect(cwRows[0].category).toBeNull();
    // Negative: the non-blank Backend row is out of scope for a [BLANK]-member group.
    expect(cwRows.some(e => e.category === 'Backend')).toBe(false);
  });
});
