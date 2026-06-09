// Regression test for handoff-fix-quarter-count.md
//
// Scope: the org-level Data Preview field exposed by `prepareSimulationData`
// as `preview.histInitCount`, rendered in `renderPreview` next to the label
// "Initiatives used (hist.)".
//
// Why this exists: before the fix, `histInitCount` reported `histInits.length`
// — the count of rows in the initiatives CSV whose `quarter` matches a
// selected historical quarter. The Poisson-λ scan in `prepareSimulationData`
// also discovers initiative keys that live ONLY in the epics CSV (the
// standalone-epics path inside the epic-iteration loop), so the preview
// number could understate — and in the user-reported case wildly understate
// (0 vs. 43) — the actual engine denominator. After the fix, the preview
// reports `countArray.length` (the size of the λ denominator the engine
// actually uses) and the label is renamed to "Initiatives used (hist.)" so
// the meaning is explicit.

import { describe, it, expect } from 'vitest';
import { loadSimulator, evalIn, execIn, csv } from '../harness.js';

function loadInitiatives(win, rows, headers) {
  const text = csv(rows, headers);
  execIn(win, `loadInitiativesCSV(${JSON.stringify(text)})`);
}

function setEpics(win, epics) {
  execIn(win, `parsedEpics = ${JSON.stringify(epics)};`);
}

// One M epic per Initiative key, all tagged with the same historical quarter.
// This makes `countArray.length === initKeys.length` and λ === 1.0 (one sized
// epic per key), so the assertions can compare against exact integers.
function standaloneEpics(initKeys, quarter) {
  return initKeys.map((k, i) => ({
    _initiative_key: k,
    _tshirt_size: 'M',
    _quarter: quarter,
    _epic_key: `EPIC-${quarter}-${i + 1}`,
  }));
}

describe('preview.histInitCount reports the engine denominator (regression for handoff-fix-quarter-count)', () => {
  it('matches countArray.length when initiatives CSV has no rows for the historical quarters but epics CSV does', () => {
    const win = loadSimulator();

    // Initiatives CSV has rows ONLY for the target quarter (Q3 2026) — none
    // for Q1 / Q2 2026. This mirrors the "Case A" shape in the handoff
    // (initiatives_q3.csv has no Q1/Q2 rows; epics CSV covers Q1/Q2/Q3).
    loadInitiatives(win, [
      { jira_key: 'I-T1', name: 'Target 1', teams: 'Team A', quarter: 'Q3 2026', category: 'Must' },
      { jira_key: 'I-T2', name: 'Target 2', teams: 'Team A', quarter: 'Q3 2026', category: 'Should' },
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);

    // 19 distinct initiative keys in Q1 + 24 distinct in Q2, discovered only
    // via epics. The pre-fix preview would have reported 0; the post-fix
    // preview must report 43 (== countArray.length == 19 + 24).
    const q1Keys = Array.from({ length: 19 }, (_, i) => `INIT-Q1-${i + 1}`);
    const q2Keys = Array.from({ length: 24 }, (_, i) => `INIT-Q2-${i + 1}`);
    setEpics(win, [
      ...standaloneEpics(q1Keys, 'Q1 2026'),
      ...standaloneEpics(q2Keys, 'Q2 2026'),
    ]);

    const result = evalIn(win, "prepareSimulationData(['Q1 2026', 'Q2 2026'], ['Q3 2026'])");

    expect(result.preview.histInitCount).toBe(43);
    // Sanity guard against the original symptom: pre-fix, `histInitCount` was
    // 0 yet λ was 1.81 — the preview claimed an empty sample while the engine
    // worked with a real one. λ must be positive whenever the denominator is.
    expect(result.lambda).toBeGreaterThan(0);
  });

  it('grows when adding a historical quarter that contributes more initiative keys via epics', () => {
    const win = loadSimulator();

    // Q3 2026 has rows in BOTH the initiatives CSV (23 of them) and the
    // epics CSV — the mixed case. Q1 / Q2 2026 are epics-only. Adding Q3 to
    // the historical scope must push the engine denominator from 43 → 66.
    const q3InitRows = Array.from({ length: 23 }, (_, i) => ({
      jira_key: `INIT-Q3-${i + 1}`,
      name: `Init Q3 ${i + 1}`,
      teams: 'Team A',
      quarter: 'Q3 2026',
      category: 'Must',
    }));
    const q4TargetRows = [
      { jira_key: 'I-T1', name: 'Target', teams: 'Team A', quarter: 'Q4 2026', category: 'Must' },
    ];
    loadInitiatives(win, [...q3InitRows, ...q4TargetRows],
      ['jira_key', 'name', 'category', 'teams', 'quarter']);

    const q1Keys = Array.from({ length: 19 }, (_, i) => `INIT-Q1-${i + 1}`);
    const q2Keys = Array.from({ length: 24 }, (_, i) => `INIT-Q2-${i + 1}`);
    const q3Keys = q3InitRows.map(r => r.jira_key);
    setEpics(win, [
      ...standaloneEpics(q1Keys, 'Q1 2026'),
      ...standaloneEpics(q2Keys, 'Q2 2026'),
      ...standaloneEpics(q3Keys, 'Q3 2026'),
    ]);

    const a = evalIn(win, "prepareSimulationData(['Q1 2026', 'Q2 2026'], ['Q4 2026'])");
    const b = evalIn(win, "prepareSimulationData(['Q1 2026', 'Q2 2026', 'Q3 2026'], ['Q4 2026'])");

    expect(a.preview.histInitCount).toBe(43);
    expect(b.preview.histInitCount).toBe(66);
  });

  it('renderPreview displays the renamed label "Initiatives used (hist.)" and the engine denominator', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      { jira_key: 'I-T1', name: 'T', teams: 'Team A', quarter: 'Q3 2026', category: 'Must' },
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);
    setEpics(win, standaloneEpics(['INIT-Q1-1', 'INIT-Q1-2'], 'Q1 2026'));

    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q3 2026'])");
    execIn(win, `renderPreview(${JSON.stringify(result.preview)});`);

    const grid = win.document.getElementById('preview-grid');
    expect(grid).toBeTruthy();
    const text = grid.textContent;

    // New label is present.
    expect(text).toMatch(/Initiatives used \(hist\.\)/);
    // Old bare label must be gone. "Initiatives used (hist.)" contains
    // "Initiatives" followed by " used", not " (hist.)", so the bare regex
    // only matches the pre-fix string.
    expect(text).not.toMatch(/Initiatives \(hist\.\)/);
    // And the rendered value is the engine denominator (2 unique keys here).
    expect(text).toMatch(/Initiatives used \(hist\.\)\s*2\b/);
  });
});
