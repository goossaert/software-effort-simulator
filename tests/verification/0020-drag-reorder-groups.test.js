// Verification test for drag-and-drop reordering of Groups (no ADR yet).
//
// Covers:
//   1. Each Group row carries the drag-handle UI affordances expected by the
//      browser's HTML5 drag API.
//   2. reorderGroup(fromIdx, beforeIdx) permutes groupsStore so the dragged
//      Group sits at the requested slot (commit-on-Run discipline is
//      preserved — no simulation re-runs).
//   3. The same permutation propagates to lastTeamData[*].kPerGroup and to
//      lastRenderState[*].results.results, so re-renders of the Organization
//      Level chart legend + Summary Statistics columns use the new order.
//   4. The trailing "+ New group" row is *not* draggable.

import { describe, it, expect } from 'vitest';
import { loadSimulator, read, execIn } from '../harness.js';

function setGroups(win, groups) {
  execIn(win, `
    groupsStore.length = 0;
    for (const g of ${JSON.stringify(groups)}) groupsStore.push(g);
  `);
}

function renderGroups(win) {
  execIn(win, 'renderGroupsTab();');
}

describe('Drag handles + draggable rows on every Group row', () => {
  it('each Group <tr> is draggable and carries a drag handle inside cell 0', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'A', color: '#aaa', members: [], isProjection: true },
      { name: 'B', color: '#bbb', members: [], isProjection: false },
      { name: 'C', color: '#ccc', members: [], isProjection: false },
    ]);
    renderGroups(win);

    const groupRows = win.document.querySelectorAll('#groups-table-wrap tbody tr[data-group-idx]');
    expect(groupRows).toHaveLength(3);
    for (const row of groupRows) {
      expect(row.getAttribute('draggable')).toBe('true');
      const firstTd = row.querySelector('td');
      expect(firstTd.querySelector('.group-drag-handle')).toBeTruthy();
      // The Name input must still exist in cell 0 (preserves AT-5 / AT-6).
      expect(firstTd.querySelector('input[type="text"]')).toBeTruthy();
    }
  });

  it('the trailing + New group row is not draggable and has no data-group-idx', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'A', color: '#aaa', members: [], isProjection: true },
    ]);
    renderGroups(win);

    const rows = win.document.querySelectorAll('#groups-table-wrap tbody tr');
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const newRow = rows[rows.length - 1];
    expect(newRow.getAttribute('draggable')).not.toBe('true');
    expect(newRow.hasAttribute('data-group-idx')).toBe(false);
    expect(newRow.querySelector('.group-new-row-btn')).toBeTruthy();
  });
});

describe('reorderGroup permutes groupsStore in place', () => {
  it('moving index 0 to before index 2 (i.e. to the middle of [A,B,C]) yields [B,A,C]', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'A', color: '#aaa', members: [], isProjection: true },
      { name: 'B', color: '#bbb', members: [], isProjection: false },
      { name: 'C', color: '#ccc', members: [], isProjection: false },
    ]);
    renderGroups(win);

    execIn(win, 'reorderGroup(0, 2);');
    const names = read(win, 'groupsStore').map(g => g.name);
    expect(names).toEqual(['B', 'A', 'C']);
  });

  it('moving the last group to the front (idx 2 -> beforeIdx 0) yields [C,A,B]', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'A', color: '#aaa', members: [], isProjection: true },
      { name: 'B', color: '#bbb', members: [], isProjection: false },
      { name: 'C', color: '#ccc', members: [], isProjection: false },
    ]);
    renderGroups(win);

    execIn(win, 'reorderGroup(2, 0);');
    expect(read(win, 'groupsStore').map(g => g.name)).toEqual(['C', 'A', 'B']);
  });

  it('moving a group to its own position is a no-op', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'A', color: '#aaa', members: [], isProjection: true },
      { name: 'B', color: '#bbb', members: [], isProjection: false },
    ]);
    renderGroups(win);

    execIn(win, 'reorderGroup(1, 2);'); // drop B just after itself
    expect(read(win, 'groupsStore').map(g => g.name)).toEqual(['A', 'B']);

    execIn(win, 'reorderGroup(0, 0);'); // drop A just before itself
    expect(read(win, 'groupsStore').map(g => g.name)).toEqual(['A', 'B']);
  });
});

describe('reorderGroup propagates the same permutation to caches', () => {
  it('lastTeamData[i].kPerGroup is reordered in lockstep with groupsStore', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'A', color: '#aaa', members: [], isProjection: true },
      { name: 'B', color: '#bbb', members: [], isProjection: false },
      { name: 'C', color: '#ccc', members: [], isProjection: false },
    ]);
    renderGroups(win);

    // Seed cached per-team K counts (one team, three groups → distinguishable K)
    execIn(win, `
      lastTeamData.length = 0;
      lastTeamData.push({ teamName: 't1', kPerGroup: [10, 20, 30] });
    `);

    execIn(win, 'reorderGroup(0, 3);'); // move A to the end → [B, C, A]
    expect(read(win, 'groupsStore').map(g => g.name)).toEqual(['B', 'C', 'A']);
    expect(read(win, 'lastTeamData')[0].kPerGroup).toEqual([20, 30, 10]);
  });

  it('lastRenderState[ctx].results.results is reordered in lockstep with groupsStore', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'A', color: '#aaa', members: [], isProjection: true },
      { name: 'B', color: '#bbb', members: [], isProjection: false },
      { name: 'C', color: '#ccc', members: [], isProjection: false },
    ]);
    renderGroups(win);

    execIn(win, `
      lastRenderState.org = {
        canvasId: 'results-chart',
        tbodyId:  'stats-tbody',
        capacity: 120,
        results: {
          globalMin: 0, globalMax: 100,
          results: [
            { name: 'A', color: '#aaa', sorted: new Float64Array([1]), stats: {}, hist: { binCenters: [], counts: [] } },
            { name: 'B', color: '#bbb', sorted: new Float64Array([2]), stats: {}, hist: { binCenters: [], counts: [] } },
            { name: 'C', color: '#ccc', sorted: new Float64Array([3]), stats: {}, hist: { binCenters: [], counts: [] } },
          ],
        },
      };
    `);

    execIn(win, 'reorderGroup(2, 0);'); // move C to the front → [C, A, B]
    expect(read(win, 'groupsStore').map(g => g.name)).toEqual(['C', 'A', 'B']);
    const cachedNames = read(win, 'lastRenderState').org.results.results.map(r => r.name);
    expect(cachedNames).toEqual(['C', 'A', 'B']);
  });
});

describe('Chart legend + Summary Statistics columns track the new order on re-render', () => {
  it('after a reorder, renderStatsTableInto produces THs in the new order', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'A', color: '#aaaaaa', members: [], isProjection: true },
      { name: 'B', color: '#bbbbbb', members: [], isProjection: false },
      { name: 'C', color: '#cccccc', members: [], isProjection: false },
    ]);
    renderGroups(win);

    // Seed cached org-level results so reorder can re-render the stats table.
    // (Org chart re-render also runs but JSDOM has no canvas — that's the
    // logged warning we accept; the stats THs we assert below are pure DOM.)
    execIn(win, `
      // Ensure the stats <tbody> exists and is wired to a <thead> the same way
      // as in production: tbody inside a table that also has a thead sibling.
      // index.html already has this structure inside #tab-org.
      lastRenderState.org = {
        canvasId: 'results-chart',
        tbodyId:  'stats-tbody',
        capacity: 120,
        results: {
          globalMin: 0, globalMax: 100,
          results: [
            { name: 'A', color: '#aaaaaa', sorted: new Float64Array([1]), stats: { p10:0,p25:0,p50:0,p75:0,p90:0,mean:0,pExceed:0 }, hist: { binCenters: [], counts: [] } },
            { name: 'B', color: '#bbbbbb', sorted: new Float64Array([2]), stats: { p10:0,p25:0,p50:0,p75:0,p90:0,mean:0,pExceed:0 }, hist: { binCenters: [], counts: [] } },
            { name: 'C', color: '#cccccc', sorted: new Float64Array([3]), stats: { p10:0,p25:0,p50:0,p75:0,p90:0,mean:0,pExceed:0 }, hist: { binCenters: [], counts: [] } },
          ],
        },
      };
    `);

    execIn(win, 'reorderGroup(0, 3);'); // move A to the end → [B, C, A]

    const thsAfter = Array.from(win.document.querySelectorAll('#stats-table thead th')).map(th => th.textContent.trim());
    // First column is "Metric"; remaining columns should be group names in new order.
    expect(thsAfter.slice(1)).toEqual(['■ B', '■ C', '■ A']);
  });
});
