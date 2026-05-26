// Additive verification tests for feature 0020 phases 1 & 2.
//
// These tests are written by the /phase-review pass and are NOT part of the
// committed acceptance suite. They cover three plan-stated counterexamples
// and invariants that the original acceptance suite did not directly assert:
//
//   1. The "forbidden shortcuts" — `prepareSimulationData` and `runSimulation`
//      must not retain `kMust / kMustShould / kMustShouldCould` or
//      `mustOnly / mustShould / mustShouldCould` as alias fields.
//   2. The plan invariant: chart dataset backgroundColor is derived from the
//      Group's `color` (a translucent rgba), and `borderColor` is fully
//      transparent (alpha === 0).
//   3. The plan invariant on Initiatives-tab datalist options: the option
//      list is sorted alphabetically (case-insensitive).

import { describe, it, expect } from 'vitest';
import { loadSimulator, read, evalIn, execIn, csv } from '../harness.js';

function loadInitiatives(win, rows, headers) {
  execIn(win, `loadInitiativesCSV(${JSON.stringify(csv(rows, headers))})`);
}

function sensibleRow(jiraKey, teams, quarter, category) {
  return { jira_key: jiraKey, name: `Init ${jiraKey}`, teams, quarter, category };
}

function setGroups(win, groups) {
  execIn(win, `groupsStore.length = 0; for (const g of ${JSON.stringify(groups)}) groupsStore.push(g);`);
}

describe('Phase 1 — forbidden legacy fields are absent from engine returns', () => {
  it('prepareSimulationData return shape carries kPerGroup only', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      sensibleRow('I-1', 'Team A', 'Q2 2026', 'Must'),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);
    execIn(win, `parsedEpics = ${JSON.stringify([{
      _initiative_key: 'I-1', _tshirt_size: 'M', _quarter: 'Q1 2026', _epic_key: 'E-1',
    }])};`);

    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    expect(result.kPerGroup).toBeDefined();
    // Forbidden legacy alias fields must be gone.
    expect(result).not.toHaveProperty('kMust');
    expect(result).not.toHaveProperty('kMustShould');
    expect(result).not.toHaveProperty('kMustShouldCould');
    expect(result.preview).not.toHaveProperty('kMust');
    expect(result.preview).not.toHaveProperty('kMustShould');
    expect(result.preview).not.toHaveProperty('kMustShouldCould');
    expect(result.preview).not.toHaveProperty('moscowGroups');
  });

  it('runSimulation return shape carries results: GroupResult[] only', () => {
    const win = loadSimulator();
    const groups = [
      { name: 'A', color: '#000', members: ['Must'], isProjection: true },
    ];
    const out = evalIn(win, `runSimulation({
      lambda: 1.0,
      epicSizingDist: ['M'],
      kPerGroup: [1],
      capacity: 120, iterations: 100, fixedEffort: 0,
      groups: ${JSON.stringify(groups)},
    })`);
    expect(Array.isArray(out.results)).toBe(true);
    // Forbidden legacy alias fields must be gone.
    expect(out).not.toHaveProperty('mustOnly');
    expect(out).not.toHaveProperty('mustShould');
    expect(out).not.toHaveProperty('mustShouldCould');
  });

  it('detectedCols carries categoryCol but not moscowCol', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      sensibleRow('I-1', 'Team A', 'Q2 2026', 'Must'),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);
    const cols = read(win, 'detectedCols');
    expect(cols).toHaveProperty('categoryCol');
    expect(cols).not.toHaveProperty('moscowCol');
  });
});

describe('Phase 1 — chart datasets derive translucent backgroundColor from Group color', () => {
  it('backgroundColor is a translucent rgba; borderColor has alpha === 0', () => {
    const win = loadSimulator();
    const groups = [
      { name: 'A', color: '#4f46e5', members: ['Must'], isProjection: true },
      { name: 'B', color: '#ea7c2c', members: ['Should'], isProjection: false },
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

    // Every dataset's backgroundColor is rgba(...) with non-zero alpha and
    // values matching the Group's hex (case-insensitive).
    function parseRgba(s) {
      const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(String(s));
      if (!m) return null;
      return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : parseFloat(m[4]) };
    }
    function hexToRgb(hex) {
      const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);
      return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
    }
    for (let i = 0; i < datasets.length; i++) {
      const bg = parseRgba(datasets[i].backgroundColor);
      const expected = hexToRgb(groups[i].color);
      expect(bg).not.toBeNull();
      expect(expected).not.toBeNull();
      expect(bg.r).toBe(expected.r);
      expect(bg.g).toBe(expected.g);
      expect(bg.b).toBe(expected.b);
      expect(bg.a).toBeGreaterThan(0);
      expect(bg.a).toBeLessThan(1);
      const border = parseRgba(datasets[i].borderColor);
      expect(border).not.toBeNull();
      expect(border.a).toBe(0);
    }
  });
});

describe('Phase 1 — Initiatives-tab datalist options are sorted alphabetically (case-insensitive)', () => {
  it('options for `KR2`, `Automation`, `KR1`, `analytics` render in alpha order', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      sensibleRow('I-1', 'Team A', 'Q2 2026', 'KR2'),
      sensibleRow('I-2', 'Team A', 'Q2 2026', 'Automation'),
      sensibleRow('I-3', 'Team A', 'Q2 2026', 'KR1'),
      sensibleRow('I-4', 'Team A', 'Q2 2026', 'analytics'),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);
    execIn(win, 'renderInitiativesTable();');

    const datalist = win.document.querySelector('datalist#category-options');
    expect(datalist).toBeTruthy();
    const values = Array.from(datalist.querySelectorAll('option')).map(o => o.value);
    const sorted = [...values].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
    expect(values).toEqual(sorted);
  });
});
