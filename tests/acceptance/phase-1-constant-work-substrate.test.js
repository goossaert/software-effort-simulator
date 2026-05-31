// Acceptance tests for feature 0021, Phase 1: the `editedConstantWork` substrate.
//
// Each `describe('AT-N: …')` block maps to one scenario in
// docs/plans/0021-constant-work-tab-and-group-scoping.md, Phase 1
// "Acceptance behavior".
//
// Behavioral rule under test (ADR-0034 substrate; mirrors feature 0019 Phase 1):
// a second module-scoped **Constant work** array `editedConstantWork` is created
// at **Constant Work CSV** load time as a per-row shallow clone of
// `parsedConstantWork` and becomes the simulation source of truth — every
// production reader of constant-work rows (`getConstantWorkEffort`,
// `getConstantWorkEpics`, and `buildTeamProjections`' constant-work-quarter
// derivation) reads `editedConstantWork`. `parsedConstantWork` stays the
// immutable parsed input (retained for the Phase 6 datalist option pools).
//
// Tests target only the public seams named in the plan:
//   • the module-scoped `editedConstantWork` binding;
//   • `loadConstantWorkCSV` / `resetConstantWorkFile` file-lifecycle behaviour;
//   • the readers `getConstantWorkEffort`, `getConstantWorkEpics`, and
//     `buildTeamProjections` (its constant-work-quarter derivation).
// They do NOT target the spread idiom, a private helper, or whether
// `cwQuarters` is inlined or extracted — the plan leaves those unconstrained.

import { describe, it, expect } from 'vitest';
import { loadSimulator, read, evalIn, execIn, csv } from '../harness.js';

// ─── Fixture helpers ────────────────────────────────────────────────
// Canonical Constant Work CSV schema (ADR-0023 / plan Data models):
//   jira_key, epic_name, key_result, category, team, quarter, tshirt_size
const CW_HEADERS = ['jira_key', 'epic_name', 'key_result', 'category', 'team', 'quarter', 'tshirt_size'];

function cwRow(overrides = {}) {
  return {
    jira_key: 'CW-1',
    epic_name: 'Locked work',
    key_result: 'KR-A',
    category: 'Backend',
    team: 'Platform',
    quarter: 'Q3 2026',
    tshirt_size: 'M',
    ...overrides,
  };
}

function loadConstantWork(win, rows, headers = CW_HEADERS) {
  const text = csv(rows, headers);
  execIn(win, `loadConstantWorkCSV(${JSON.stringify(text)})`);
}

function loadInitiatives(win, rows, headers) {
  const text = csv(rows, headers);
  execIn(win, `loadInitiativesCSV(${JSON.stringify(text)})`);
}

function initiativeRow(jiraKey, teams, quarter, category) {
  return { jira_key: jiraKey, building_block: `Init ${jiraKey}`, category, teams, quarter };
}

// ─── AT-1: load creates editedConstantWork as a per-row shallow clone ─
describe('AT-1: loading a Constant Work CSV creates editedConstantWork as a per-row shallow clone of parsedConstantWork', () => {
  it('clones every row into a new top-level array with equal length, distinct row references, equal values, and equal key order', () => {
    const win = loadSimulator();
    loadConstantWork(win, [
      cwRow({ jira_key: 'CW-1', category: 'Backend', quarter: 'Q3 2026', tshirt_size: 'M' }),
      cwRow({ jira_key: 'CW-2', category: 'Frontend', quarter: 'Q4 2026', tshirt_size: 'L' }),
      cwRow({ jira_key: 'CW-3', category: 'Ops', quarter: 'Q3 2026', tshirt_size: 'S' }),
    ]);

    const edited = read(win, 'editedConstantWork');
    const parsed = read(win, 'parsedConstantWork');

    expect(Array.isArray(edited)).toBe(true);
    expect(edited).not.toBe(parsed); // a NEW top-level array
    expect(edited.length).toBe(parsed.length);

    // Property assertion over every row and every key: distinct object
    // references, value-equal cells, identical key order.
    for (let i = 0; i < parsed.length; i++) {
      expect(edited[i]).not.toBe(parsed[i]);
      expect(Object.keys(edited[i])).toEqual(Object.keys(parsed[i]));
      for (const k of Object.keys(parsed[i])) {
        expect(edited[i][k]).toBe(parsed[i][k]);
      }
    }
  });
});

// ─── AT-2: editing editedConstantWork does not mutate parsedConstantWork ─
describe('AT-2: mutating editedConstantWork[i][k] leaves parsedConstantWork[i][k] unchanged', () => {
  it('keeps parsedConstantWork as the immutable parse output when a clone cell is reassigned', () => {
    const win = loadSimulator();
    loadConstantWork(win, [cwRow({ tshirt_size: 'M' })]);

    execIn(win, "editedConstantWork[0].tshirt_size = 'XL';");

    expect(read(win, 'editedConstantWork')[0].tshirt_size).toBe('XL');
    expect(read(win, 'parsedConstantWork')[0].tshirt_size).toBe('M'); // unchanged
  });
});

// ─── AT-3: resetConstantWorkFile nulls both arrays ──────────────────
describe('AT-3: resetConstantWorkFile sets both parsedConstantWork and editedConstantWork to null', () => {
  it('clears the constant-work substrate completely on file clear', () => {
    const win = loadSimulator();
    loadConstantWork(win, [cwRow(), cwRow({ jira_key: 'CW-2' })]);
    expect(read(win, 'editedConstantWork')).not.toBeNull();

    execIn(win, 'resetConstantWorkFile();');

    expect(read(win, 'parsedConstantWork')).toBeNull();
    expect(read(win, 'editedConstantWork')).toBeNull();
  });
});

// ─── AT-4: getConstantWorkEffort reads editedConstantWork ───────────
describe('AT-4: getConstantWorkEffort reads editedConstantWork (deterministic person-months reflect edits)', () => {
  it('returns the person-months of the EDITED t-shirt size, not the original parsed size', () => {
    const win = loadSimulator();
    loadConstantWork(win, [cwRow({ quarter: 'Q3 2026', tshirt_size: 'M' })]);

    // Property assertion: for any recognised t-shirt size the edit reflects.
    for (const size of ['S', 'L', 'XL']) {
      execIn(win, `editedConstantWork[0].tshirt_size = ${JSON.stringify(size)};`);
      const actual = evalIn(win, "getConstantWorkEffort(['Q3 2026'])");
      const expected = evalIn(win, `tshirtToPersonMonths(${JSON.stringify(size)})`);
      expect(actual).toBe(expected);
    }

    // Negative: the edited XL value is NOT the original M value.
    expect(evalIn(win, "getConstantWorkEffort(['Q3 2026'])"))
      .not.toBe(evalIn(win, "tshirtToPersonMonths('M')"));
    // The immutable substrate is untouched by the edits.
    expect(read(win, 'parsedConstantWork')[0].tshirt_size).toBe('M');
  });
});

// ─── AT-5: getConstantWorkEpics reads editedConstantWork ────────────
describe('AT-5: getConstantWorkEpics reads editedConstantWork', () => {
  it("returns the EDITED epic name for the row's team and quarter", () => {
    const win = loadSimulator();
    loadConstantWork(win, [cwRow({ team: 'Platform', quarter: 'Q3 2026', epic_name: 'Original name' })]);

    execIn(win, "editedConstantWork[0].epic_name = 'Edited name';");

    const epics = evalIn(win, "getConstantWorkEpics('Q3 2026', 'Platform')");
    expect(Array.isArray(epics)).toBe(true);
    expect(epics).toHaveLength(1);
    expect(epics[0].name).toBe('Edited name'); // edited value
    expect(read(win, 'parsedConstantWork')[0].epic_name).toBe('Original name'); // unchanged
  });
});

// ─── AT-6: buildTeamProjections derives constant-work quarters from editedConstantWork ─
describe('AT-6: buildTeamProjections derives constant-work quarters from editedConstantWork', () => {
  it("includes a team's EDITED constant-work quarter and drops the original parsed quarter", () => {
    const win = loadSimulator();
    // The team must appear in the Initiatives CSV for buildTeamProjections to
    // discover it; its constant work lives in a quarter we then edit.
    loadInitiatives(win, [
      initiativeRow('I-1', 'Platform', 'Q3 2026', 'Backend'),
    ], ['jira_key', 'building_block', 'category', 'teams', 'quarter']);
    loadConstantWork(win, [cwRow({ team: 'Platform', quarter: 'Q4 2026', tshirt_size: 'M' })]);

    execIn(win, "editedConstantWork[0].quarter = 'Q1 2027';");

    const proj = evalIn(win, "buildTeamProjections(['Q3 2026'], 1.0, ['M'], 200)");
    const platform = proj.find(p => p.teamName === 'Platform');
    expect(platform).toBeTruthy();

    const quarters = Object.keys(platform.byQuarter);
    expect(quarters).toContain('Q1 2027'); // the edited quarter
    expect(quarters).not.toContain('Q4 2026'); // the original parsed quarter is gone
  });
});

// ─── AT-7: no Constant Work CSV loaded → readers return empty values ─
describe('AT-7: with no Constant Work CSV loaded the readers return their empty values', () => {
  it('keeps both arrays null and returns 0 / [] from the readers', () => {
    const win = loadSimulator();

    expect(read(win, 'parsedConstantWork')).toBeNull();
    expect(read(win, 'editedConstantWork')).toBeNull(); // declared `let editedConstantWork = null`

    expect(evalIn(win, "getConstantWorkEffort(['Q3 2026'])")).toBe(0);
    expect(evalIn(win, "getConstantWorkEpics('Q3 2026', 'Platform')")).toEqual([]);
  });
});

// ─── AT-8: fresh load with no edits is transparent (identical reader output) ─
describe('AT-8: a freshly-loaded Constant Work CSV with no edits feeds the Run identically (transparent indirection)', () => {
  it('makes editedConstantWork a structural clone of parsedConstantWork and the readers report the same effort', () => {
    const win = loadSimulator();
    loadConstantWork(win, [
      cwRow({ jira_key: 'CW-1', quarter: 'Q3 2026', tshirt_size: 'M' }),
      cwRow({ jira_key: 'CW-2', quarter: 'Q3 2026', tshirt_size: 'L' }),
      cwRow({ jira_key: 'CW-3', quarter: 'Q4 2026', tshirt_size: 'S' }),
    ]);

    const parsed = read(win, 'parsedConstantWork');
    const edited = read(win, 'editedConstantWork');

    // The clone carries the same data into the Run as a build reading
    // parsedConstantWork directly. Constant work only enters the simulation via
    // these readers (ADR-0033 — it never touches K / λ / the bootstrap pool),
    // so reader-level identity == Run-level identity (modulo Monte Carlo seed).
    expect(edited).toEqual(parsed);

    const quarters = [...new Set(parsed.map(r => r.quarter))];
    const expected = parsed.reduce(
      (s, r) => (quarters.includes(r.quarter)
        ? s + evalIn(win, `tshirtToPersonMonths(${JSON.stringify(r.tshirt_size)})`)
        : s),
      0,
    );
    const actual = evalIn(win, `getConstantWorkEffort(${JSON.stringify(quarters)})`);
    expect(actual).toBeCloseTo(expected, 10);
  });
});

// ─── AT-9: re-loading a Constant Work CSV rebuilds the clone wholesale ─
describe('AT-9: re-loading a Constant Work CSV rebuilds the clone wholesale and discards prior edits', () => {
  it('replaces editedConstantWork with a fresh clone of the new file and drops the earlier edit', () => {
    const win = loadSimulator();
    loadConstantWork(win, [cwRow({ jira_key: 'CW-A', tshirt_size: 'M' })]);
    execIn(win, "editedConstantWork[0].tshirt_size = 'XL';");

    // Load a different Constant Work CSV.
    loadConstantWork(win, [cwRow({ jira_key: 'CW-B', tshirt_size: 'S' })]);

    const parsed = read(win, 'parsedConstantWork');
    const edited = read(win, 'editedConstantWork');
    expect(edited).toEqual(parsed); // wholesale fresh clone of B
    expect(edited[0].jira_key).toBe('CW-B');
    expect(edited[0].tshirt_size).toBe('S'); // the prior XL edit is gone
  });
});
