// Inner tests for feature 0020, Phase 3: loadGroupsJSON validation +
// isProjection normalisation.
//
// These tests triangulate the validation boundaries the acceptance scenarios
// (phase-3-json-persistence.test.js) cover only by examples. The acceptance
// suite shows that a given input passes or fails; the inner suite proves the
// rule itself.
//
// Seam under test: `loadGroupsJSON(text): { ok, error?, groups? }`.
// Named in plan §3 "Public entry point". The plan also says inner tests are
// N/A for the manual harness — these tests are deliberately scoped to the
// validation rules that the plan's "Invariants" and "Counterexamples"
// sections specify, and which are easy to break in ways that pass the
// example-only acceptance tests.
//
// Triangulation pattern for each rule:
//   • Happy path (canonical valid example);
//   • Boundary (edge of the rule — e.g. exactly schemaVersion 1);
//   • Negative (a case that must produce ok:false);
//   • Property-style (a quantifier over a range of inputs).

import { describe, it, expect } from 'vitest';
import { loadSimulator, evalIn } from '../harness.js';

function loadResult(win, value) {
  // Allow callers to pass a JS value (will be JSON.stringify'd) or a raw
  // string for malformed-input cases.
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return evalIn(win, `loadGroupsJSON(${JSON.stringify(text)})`);
}

const VALID_GROUP = { name: 'G', color: '#000000', members: [], isProjection: true };
const wrap = (groups, schemaVersion = 1) => ({ schemaVersion, groups });

// ─── schemaVersion policy ───────────────────────────────────────────
describe('inner: schemaVersion policy', () => {
  it('happy: schemaVersion exactly 1 is accepted', () => {
    const win = loadSimulator();
    expect(loadResult(win, wrap([VALID_GROUP], 1)).ok).toBe(true);
  });

  it('boundary: missing schemaVersion is treated as 1 (per ADR-0030 read-permissive within major)', () => {
    const win = loadSimulator();
    const result = loadResult(win, { groups: [VALID_GROUP] });
    expect(result.ok).toBe(true);
  });

  it('negative: schemaVersion 2 is rejected with a "newer version" error', () => {
    const win = loadSimulator();
    const result = loadResult(win, wrap([VALID_GROUP], 2));
    expect(result.ok).toBe(false);
    expect(String(result.error)).toMatch(/newer version/i);
  });

  it('negative: schemaVersion as the string "1" is rejected (counterexample in plan)', () => {
    const win = loadSimulator();
    const result = loadResult(win, wrap([VALID_GROUP], '1'));
    expect(result.ok).toBe(false);
  });

  it('property: every schemaVersion > 1 is rejected (sample over [2, 3, 10, 999])', () => {
    const win = loadSimulator();
    for (const v of [2, 3, 10, 999]) {
      const result = loadResult(win, wrap([VALID_GROUP], v));
      expect(result.ok, `schemaVersion=${v} should reject`).toBe(false);
    }
  });
});

// ─── Top-level wrapper shape ────────────────────────────────────────
describe('inner: top-level wrapper shape', () => {
  it('happy: { schemaVersion: 1, groups: [...] } parses', () => {
    const win = loadSimulator();
    expect(loadResult(win, wrap([VALID_GROUP])).ok).toBe(true);
  });

  it('negative: top-level array is rejected', () => {
    const win = loadSimulator();
    expect(loadResult(win, [VALID_GROUP]).ok).toBe(false);
  });

  it('negative: top-level null is rejected', () => {
    const win = loadSimulator();
    expect(loadResult(win, 'null').ok).toBe(false);
  });

  it('negative: object missing groups field is rejected with "groups" in the message', () => {
    const win = loadSimulator();
    const result = loadResult(win, { schemaVersion: 1 });
    expect(result.ok).toBe(false);
    expect(String(result.error)).toMatch(/groups/i);
  });

  it('negative: groups as an object (not array) is rejected', () => {
    const win = loadSimulator();
    expect(loadResult(win, { schemaVersion: 1, groups: { foo: 'bar' } }).ok).toBe(false);
  });

  it('boundary: groups: [] is accepted and produces groups: []', () => {
    const win = loadSimulator();
    const result = loadResult(win, wrap([]));
    expect(result.ok).toBe(true);
    expect(result.groups).toEqual([]);
  });
});

// ─── Per-Group field shape ──────────────────────────────────────────
describe('inner: per-Group field-shape validation', () => {
  it('happy: name:string, color:string, members:array, isProjection:bool all pass', () => {
    const win = loadSimulator();
    const result = loadResult(win, wrap([
      { name: 'G', color: '#abcdef', members: ['Must', null], isProjection: false },
    ]));
    expect(result.ok).toBe(true);
  });

  it('negative: members as a string is rejected (counterexample AT-24)', () => {
    const win = loadSimulator();
    expect(loadResult(win, wrap([{ ...VALID_GROUP, members: 'not an array' }])).ok).toBe(false);
  });

  it('negative: members as an object is rejected', () => {
    const win = loadSimulator();
    expect(loadResult(win, wrap([{ ...VALID_GROUP, members: { x: 1 } }])).ok).toBe(false);
  });

  it('boundary: members as an empty array is allowed (zero-member Groups are lenient per ADR-0029)', () => {
    const win = loadSimulator();
    const result = loadResult(win, wrap([{ ...VALID_GROUP, members: [] }]));
    expect(result.ok).toBe(true);
    expect(result.groups[0].members).toEqual([]);
  });

  it('boundary: members containing both strings and null is allowed (mixed-content invariant)', () => {
    const win = loadSimulator();
    const result = loadResult(win, wrap([
      { ...VALID_GROUP, members: ['Must', null, 'Should', null, '📊 Analytics'] },
    ]));
    expect(result.ok).toBe(true);
    expect(result.groups[0].members).toEqual(['Must', null, 'Should', null, '📊 Analytics']);
  });
});

// ─── isProjection normalisation at load time ────────────────────────
describe('inner: isProjection invariant normalisation', () => {
  it('happy: exactly one isProjection:true is preserved as-is', () => {
    const win = loadSimulator();
    const result = loadResult(win, wrap([
      { name: 'A', color: '#000', members: [], isProjection: false },
      { name: 'B', color: '#111', members: [], isProjection: true },
      { name: 'C', color: '#222', members: [], isProjection: false },
    ]));
    expect(result.ok).toBe(true);
    expect(result.groups.map(g => g.isProjection)).toEqual([false, true, false]);
  });

  it('boundary: multiple isProjection:true → only first survives (first-wins)', () => {
    const win = loadSimulator();
    const result = loadResult(win, wrap([
      { name: 'A', color: '#000', members: [], isProjection: true  },
      { name: 'B', color: '#111', members: [], isProjection: true  },
      { name: 'C', color: '#222', members: [], isProjection: false },
    ]));
    expect(result.ok).toBe(true);
    expect(result.groups.map(g => g.isProjection)).toEqual([true, false, false]);
  });

  it('boundary: zero isProjection:true → first promoted (first-by-default)', () => {
    const win = loadSimulator();
    const result = loadResult(win, wrap([
      { name: 'A', color: '#000', members: [], isProjection: false },
      { name: 'B', color: '#111', members: [], isProjection: false },
    ]));
    expect(result.ok).toBe(true);
    expect(result.groups.map(g => g.isProjection)).toEqual([true, false]);
  });

  it('boundary: a single Group with isProjection:false is promoted to true', () => {
    const win = loadSimulator();
    const result = loadResult(win, wrap([
      { name: 'Only', color: '#000', members: [], isProjection: false },
    ]));
    expect(result.ok).toBe(true);
    expect(result.groups[0].isProjection).toBe(true);
  });

  it('boundary: zero Groups → no normalisation needed (invariant vacuously holds)', () => {
    const win = loadSimulator();
    const result = loadResult(win, wrap([]));
    expect(result.ok).toBe(true);
    expect(result.groups).toEqual([]);
  });

  it('property: returned groups always have exactly-one or zero isProjection:true (over sample variations)', () => {
    const win = loadSimulator();
    const variations = [
      [{ name: 'A', isProjection: true }],
      [{ name: 'A', isProjection: false }],
      [{ name: 'A', isProjection: true }, { name: 'B', isProjection: true }],
      [{ name: 'A', isProjection: false }, { name: 'B', isProjection: false }],
      [{ name: 'A', isProjection: true }, { name: 'B', isProjection: false }, { name: 'C', isProjection: true }],
    ];
    for (const groups of variations) {
      const full = groups.map(g => ({ color: '#000', members: [], ...g }));
      const result = loadResult(win, wrap(full));
      expect(result.ok, `variation=${JSON.stringify(groups)}`).toBe(true);
      const flagged = result.groups.filter(g => g.isProjection);
      expect(flagged.length, `variation=${JSON.stringify(groups)}`).toBe(1);
      // First-flagged-or-first-by-default semantics: the surviving flag is
      // always on the FIRST group that originally had it (if any), else on
      // groups[0].
      const firstOriginalFlag = full.findIndex(g => g.isProjection);
      const survivingIdx = result.groups.findIndex(g => g.isProjection);
      expect(survivingIdx).toBe(firstOriginalFlag === -1 ? 0 : firstOriginalFlag);
    }
  });
});

// ─── Unknown-field forward-compat ───────────────────────────────────
describe('inner: unknown fields on a Group are silently dropped (forward-compat)', () => {
  it('happy: a known-only Group passes through with its four documented fields', () => {
    const win = loadSimulator();
    const result = loadResult(win, wrap([VALID_GROUP]));
    expect(result.ok).toBe(true);
    expect(Object.keys(result.groups[0]).sort()).toEqual(
      ['color', 'isProjection', 'members', 'name'].sort()
    );
  });

  it('boundary: a Group with one extra field still parses cleanly; the field is dropped', () => {
    const win = loadSimulator();
    const result = loadResult(win, wrap([
      { ...VALID_GROUP, futureField: 'something' },
    ]));
    expect(result.ok).toBe(true);
    expect(result.groups[0].futureField).toBeUndefined();
  });

  it('boundary: a Group with several extra fields still parses (multiple unknowns ignored together)', () => {
    const win = loadSimulator();
    const result = loadResult(win, wrap([
      { ...VALID_GROUP, foo: 1, bar: 'b', baz: { nested: true } },
    ]));
    expect(result.ok).toBe(true);
    expect(result.groups[0].foo).toBeUndefined();
    expect(result.groups[0].bar).toBeUndefined();
    expect(result.groups[0].baz).toBeUndefined();
  });
});

// ─── Parse-error surface ────────────────────────────────────────────
describe('inner: malformed JSON returns a parse error', () => {
  it('boundary: empty string is rejected', () => {
    const win = loadSimulator();
    expect(loadResult(win, '').ok).toBe(false);
  });

  it('negative: truncated JSON is rejected', () => {
    const win = loadSimulator();
    expect(loadResult(win, '{ "schemaVersion": 1, "groups": [').ok).toBe(false);
  });

  it('property: every input that fails JSON.parse returns ok:false (no throw escapes)', () => {
    const win = loadSimulator();
    const samples = [
      '{ "schemaVersion": 1',          // truncated object
      '{ groups: [] }',                 // unquoted key
      '{ "schemaVersion": 1, , }',      // trailing comma
      'not json at all',                // bare text
      '[[[',                            // nested-open brackets
    ];
    for (const s of samples) {
      const result = loadResult(win, s);
      expect(result.ok, `sample=${JSON.stringify(s)}`).toBe(false);
      expect(result.error, `sample=${JSON.stringify(s)}`).toBeTruthy();
    }
  });
});
