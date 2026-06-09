// Acceptance tests for feature 0021, Phase 3:
//   Team Level surface honors Category-scoping — `prepareTeamSimulationData`
//   replaces its per-team scalar constant-work effort with a per-team
//   `fixedEffortPerGroup` (team match AND Category membership), and
//   `renderTeamSection` consumes that vector.
//
// Each `describe('AT-N: …')` block maps to one scenario in
// docs/plans/0021-constant-work-tab-and-group-scoping.md, Phase 3
// "Acceptance behavior".
//
// Behavioral rule under test (ADR-0033, Team Level surface):
//   `prepareTeamSimulationData` replaces the per-team scalar constant-work
//   effort (`getConstantWorkEffort(targetQuarters, teamName)`) with a per-team
//   `fixedEffortPerGroup`: for each team and each Group, sum
//   `tshirtToPersonMonths(size)` over `editedConstantWork` rows whose `team`
//   matches the team (case-insensitive, existing convention), whose
//   `quarter ∈ targetQuarters`, and whose **Category** ∈ `group.members`
//   (trim + case-fold; the **(Blank) sentinel** matches blank-Category rows).
//   The team match AND-composes with the Category filter. `renderTeamSection`
//   and the per-team `runSimulation` call consume `fixedEffortPerGroup` exactly
//   as the org headline does (Phase 2). Constant work still contributes ZERO to
//   the team's `kPerGroup` / **Poisson λ** / **Bootstrap pool**.
//
// Seams targeted (autonomously chosen — see the atdd handover):
//   • The per-team, Category-scoped, group-aligned vector via the plan-named
//     stable seam `prepareTeamSimulationData(hist, target, orgLambda,
//     orgSizing)[i].fixedEffortPerGroup` — NOT a private helper name (the plan
//     leaves "shared helper with a teamName filter vs inline" unconstrained).
//   • `renderTeamSection` consuming that per-team vector — asserted through the
//     **Team Level tab**'s rendered stats table (the user-observable surface).
//   These do NOT lock in: whether the team vector reuses the Phase 2 helper with
//   a `teamName` argument or is computed inline; the contract is the team-scoped,
//   Category-scoped, group-aligned vector.

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

// `prepareTeamSimulationData` iterates `parsedEpics`, so it must be non-null.
// Constant work must NOT influence λ / the epic pool, so an empty pool is fine —
// the per-team K stays 0 (the test Categories are in no Group's members) and the
// constant-work vector is isolated.
function setEpics(win, epics) {
  execIn(win, `parsedEpics = ${JSON.stringify(epics)};`);
}

function setGroups(win, groups) {
  execIn(win, `groupsStore.length = 0; for (const g of ${JSON.stringify(groups)}) groupsStore.push(g);`);
}

// Mount constant-work rows directly on the simulation source of truth
// (`editedConstantWork`, the Phase 1 substrate). The engine reads
// `team`/`category`/`quarter`/`tshirt_size`.
function setConstantWork(win, rows) {
  execIn(win, `editedConstantWork = ${JSON.stringify(rows)};`);
}

function pm(win, size) {
  return evalIn(win, `tshirtToPersonMonths(${JSON.stringify(size)})`);
}

// The per-team, Category-scoped constant-work vector is reported by
// `prepareTeamSimulationData` (the plan's stable seam): one entry per team
// present in the Target quarters, each carrying a `fixedEffortPerGroup` aligned
// index-for-index with `groupsStore`.
function prepareTeams(win, histQuarters, targetQuarters, orgLambda = 1.0, orgEpicSizingDist = ['M']) {
  return evalIn(
    win,
    `prepareTeamSimulationData(${JSON.stringify(histQuarters)}, ${JSON.stringify(targetQuarters)}, ${orgLambda}, ${JSON.stringify(orgEpicSizingDist)})`
  );
}

function findTeam(teams, name) {
  return teams.find(t => t.teamName.toLowerCase() === name.toLowerCase());
}

// ─── AT-1: a team's matching-Category row lifts only the matching Group ──
describe('AT-1: a team section lifts only the Groups whose members include a matching-team constant-work row\'s Category', () => {
  it('credits the team\'s matching Group its t-shirt person-months, leaves the non-matching Group at 0, and ignores rows outside the Target quarters', () => {
    const win = loadSimulator();
    loadInitiatives(win, [initiativeRow('I-1', 'Platform', 'Q3 2026', 'ScaffoldCat')]);
    setEpics(win, []);
    setGroups(win, [
      { name: 'Backend',  color: '#a', members: ['Backend'],  isProjection: true },
      { name: 'Frontend', color: '#b', members: ['Frontend'], isProjection: false },
    ]);
    setConstantWork(win, [
      { team: 'Platform', category: 'Backend', quarter: 'Q3 2026', tshirt_size: 'M' },
      // Boundary: a matching-team, matching-Category row OUTSIDE the Target
      // quarters must not count toward the team's vector.
      { team: 'Platform', category: 'Backend', quarter: 'Q4 2026', tshirt_size: 'XL' },
    ]);

    const platform = findTeam(prepareTeams(win, ['Q1 2026'], ['Q3 2026']), 'Platform');
    expect(platform).toBeTruthy();
    const vec = platform.fixedEffortPerGroup;
    expect(Array.isArray(vec)).toBe(true);
    expect(vec).toHaveLength(2);
    expect(vec[0]).toBeCloseTo(pm(win, 'M'), 10); // Backend lifted by the Q3 row only
    expect(vec[1]).toBe(0);                        // Frontend untouched
  });
});

// ─── AT-2: a constant-work row for another team does not lift this team ──
describe('AT-2: a constant-work row for another team does not lift this team', () => {
  it('leaves every Group entry of the non-matching team at 0 while the matching team is lifted', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      initiativeRow('I-1', 'Platform', 'Q3 2026', 'ScaffoldCat'),
      initiativeRow('I-2', 'Risk',     'Q3 2026', 'ScaffoldCat'),
    ]);
    setEpics(win, []);
    setGroups(win, [
      { name: 'Backend',  color: '#a', members: ['Backend'],  isProjection: true },
      { name: 'Frontend', color: '#b', members: ['Frontend'], isProjection: false },
    ]);
    setConstantWork(win, [
      { team: 'Platform', category: 'Backend', quarter: 'Q3 2026', tshirt_size: 'M' },
    ]);

    const teams = prepareTeams(win, ['Q1 2026'], ['Q3 2026']);
    const risk = findTeam(teams, 'Risk');
    expect(risk).toBeTruthy();
    // Negative: the Platform-owned row lifts nothing on the Risk team.
    expect(risk.fixedEffortPerGroup).toEqual([0, 0]);

    // Contrast so the all-zero vector above is meaningful, not vacuous: the same
    // row DOES lift its own team's matching Group.
    const platform = findTeam(teams, 'Platform');
    expect(platform.fixedEffortPerGroup[0]).toBeCloseTo(pm(win, 'M'), 10);
    expect(platform.fixedEffortPerGroup[1]).toBe(0);
  });
});

// ─── AT-3: the per-team vector is group-aligned, team- AND Category-scoped ──
describe('AT-3: the per-team vector is aligned with the Groups and is team-scoped AND Category-scoped', () => {
  it('has one entry per Group and excludes the team\'s constant-work row whose Category is in no Group', () => {
    const win = loadSimulator();
    loadInitiatives(win, [initiativeRow('I-1', 'Platform', 'Q3 2026', 'ScaffoldCat')]);
    setEpics(win, []);
    setGroups(win, [{ name: 'Backend', color: '#a', members: ['Backend'], isProjection: true }]);
    setConstantWork(win, [
      { team: 'Platform', category: 'Backend', quarter: 'Q3 2026', tshirt_size: 'M' }, // in the Group
      { team: 'Platform', category: 'Ops',     quarter: 'Q3 2026', tshirt_size: 'L' }, // in no Group → excluded
    ]);

    const platform = findTeam(prepareTeams(win, ['Q1 2026'], ['Q3 2026']), 'Platform');
    const vec = platform.fixedEffortPerGroup;
    expect(vec).toHaveLength(1);                  // aligned with groupsStore (length 1)
    expect(vec[0]).toBeCloseTo(pm(win, 'M'), 10); // only the Backend row; the Ops row is excluded
  });
});

// ─── AT-4: the Team Level tab stats reflect the per-Group team shift ──
describe('AT-4: the Team Level tab stats reflect the per-Group team shift', () => {
  it('shifts only the Group whose Category matches the team\'s constant work; the other Group\'s column is not lifted', () => {
    const win = loadSimulator();
    // The Platform initiative carries a Category in NO Group, so every Group's
    // K is 0 → each Group's distribution sits flat at exactly its own per-Group
    // constant-work shift, making the rendered Median (P50) directly checkable.
    loadInitiatives(win, [initiativeRow('I-1', 'Platform', 'Q3 2026', 'ScaffoldCat')]);
    setEpics(win, []);
    setGroups(win, [
      { name: 'Backend',  color: '#a', members: ['Backend'],  isProjection: true },
      { name: 'Frontend', color: '#b', members: ['Frontend'], isProjection: false },
    ]);
    setConstantWork(win, [
      { team: 'Platform', category: 'Backend', quarter: 'Q3 2026', tshirt_size: 'L' },
    ]);

    // Build per-team data in-realm, cache it as the render source, and render the
    // (sole) Platform section into a mounted stats table — the Team Level tab's
    // observable surface.
    execIn(win, `
      lastTeamData   = prepareTeamSimulationData(['Q1 2026'], ['Q3 2026'], 1.0, ['M']);
      lastCapacity   = 120;
      lastIterations = 200;
    `);
    win.document.body.insertAdjacentHTML('beforeend', `
      <div><canvas id="team-chart-0"></canvas></div>
      <table><thead id="team-stats-thead-0"></thead><tbody id="team-stats-tbody-0"></tbody></table>
    `);
    execIn(win, `renderTeamSection(0, lastTeamData[0].useOrgByDefault);`);

    const tbody = win.document.getElementById('team-stats-tbody-0');
    const medianRow = [...tbody.querySelectorAll('tr')].find(
      tr => tr.querySelector('td')?.textContent.includes('Median')
    );
    expect(medianRow).toBeTruthy();
    const valCells = [...medianRow.querySelectorAll('td.val')];
    expect(valCells).toHaveLength(2); // one column per Group
    // Backend (Category match) is lifted to its constant-work PM; Frontend is not.
    expect(valCells[0].textContent.trim()).toBe(pm(win, 'L').toFixed(1)); // Backend lifted
    expect(valCells[1].textContent.trim()).toBe('0.0');                    // Frontend not lifted
  });
});

// ─── AT-5: case-insensitive team match (existing convention preserved) ──
describe('AT-5: the per-team constant-work match is case-insensitive on the team name', () => {
  it('credits a row whose team casing differs from the initiative team, and still excludes other teams\' rows', () => {
    const win = loadSimulator();
    loadInitiatives(win, [initiativeRow('I-1', 'Platform', 'Q3 2026', 'ScaffoldCat')]);
    setEpics(win, []);
    setGroups(win, [{ name: 'Backend', color: '#a', members: ['Backend'], isProjection: true }]);
    setConstantWork(win, [
      // Property: a lowercase team string matches the canonical 'Platform' team.
      { team: 'platform', category: 'Backend', quarter: 'Q3 2026', tshirt_size: 'M' },
      // Negative: a different team's row must not leak into Platform's vector.
      { team: 'risk',     category: 'Backend', quarter: 'Q3 2026', tshirt_size: 'XL' },
    ]);

    const platform = findTeam(prepareTeams(win, ['Q1 2026'], ['Q3 2026']), 'Platform');
    expect(platform).toBeTruthy();
    // Only the case-insensitively-matching 'platform' row counts (M), not the
    // 'risk' row (XL) — so the entry is exactly pm('M'), not pm('M') + pm('XL').
    expect(platform.fixedEffortPerGroup[0]).toBeCloseTo(pm(win, 'M'), 10);
  });
});
