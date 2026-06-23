// Acceptance tests for feature 0023 (Error Report tab), Phase 2 — Initiative &
// cross-reference integrity + Constant work exclusion (codes 13-18):
// INIT_MISSING_KEY, INIT_BAD_QUARTER, INIT_MISSING_TEAM_OR_CATEGORY,
// DANGLING_EPIC_LINK, TARGET_QUARTER_NO_INITIATIVES, CONSTANT_WORK_EXCLUDED.
// (former Phase 5 — AT-1..AT-6.)
//
// Seam: prepareSimulationData(histQs, targetQs).findings. CONSTANT_WORK_EXCLUDED
// reuses getConstantWorkExcluded(...) as the single source (ADR-0037) — the test
// reads that helper's {pm, rows} and asserts the finding's impact matches.
// Vocabulary verbatim from CONTEXT.md: Initiative, Initiative key, Quarter,
// Category, Epic, Constant work, Group.
//
// RED on the current base: codes 13-18 are unimplemented, so findings carries none.

import { describe, it, expect } from 'vitest';
import { loadSimulator, evalIn, execIn, csv } from '../harness.js';

const H = ['jira_key', 'name', 'category', 'teams', 'quarter'];

function loadInitiatives(win, rows) {
  execIn(win, `loadInitiativesCSV(${JSON.stringify(csv(rows, H))})`);
}
function setEpics(win, epics) {
  execIn(win, `parsedEpics = ${JSON.stringify(epics)};`);
}
function setConstantWork(win, rows) {
  execIn(win, `editedConstantWork = ${JSON.stringify(rows)};`);
}
// Extract numeric tokens from a string (for single-source PM equality checks).
function numbersIn(s) {
  return (`${s}`.match(/-?\d+(?:\.\d+)?/g) || []).map(parseFloat);
}

// ─── AT-1 (code 13): row missing/blank Initiative key (WARNING) ────────────
describe('AT-1: an Initiatives row whose Initiative key cell is blank is reported as INIT_MISSING_KEY (WARNING)', () => {
  it('reports one INIT_MISSING_KEY finding with a row locator for the blank-key row only', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      { jira_key: 'I-1', name: 'ok', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' },
      { jira_key: '', name: 'no key', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' },
    ]);
    setEpics(win, []);

    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    const flagged = result.findings.filter(f => f.code === 'INIT_MISSING_KEY');
    expect(flagged).toHaveLength(1);
    expect(flagged[0].severity).toBe('WARNING');
    expect(flagged[0].category).toBe('Initiative integrity');
    expect(flagged[0].locators.some(l => l.kind === 'row')).toBe(true);
  });
});

// ─── AT-2 (code 14): row with a bad Quarter (WARNING) ──────────────────────
describe('AT-2: an Initiatives row with a blank Quarter or a Quarter in no selected window is reported as INIT_BAD_QUARTER (WARNING)', () => {
  it('reports INIT_BAD_QUARTER for the blank-quarter row and the not-selected-quarter row, but not for valid rows', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      { jira_key: 'I-1', name: 'valid', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' },
      { jira_key: 'I-B', name: 'blank q', category: 'Must', teams: 'Team A', quarter: '' },
      { jira_key: 'I-C', name: 'unselected q', category: 'Must', teams: 'Team A', quarter: 'Q9 2099' },
    ]);
    setEpics(win, []);

    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    const flagged = result.findings.filter(f => f.code === 'INIT_BAD_QUARTER');
    expect(flagged).toHaveLength(2);
    for (const f of flagged) {
      expect(f.severity).toBe('WARNING');
      expect(f.category).toBe('Initiative integrity');
      expect(f.locators.some(l => l.kind === 'row')).toBe(true);
    }
  });
});

// ─── AT-3 (code 15): row missing team or Category (WARNING) ────────────────
describe('AT-3: an Initiatives row with a blank team or a blank Category is reported as INIT_MISSING_TEAM_OR_CATEGORY (WARNING)', () => {
  it('reports INIT_MISSING_TEAM_OR_CATEGORY for the blank-category row and the blank-team row', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      { jira_key: 'I-1', name: 'valid', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' },
      { jira_key: 'I-NC', name: 'no cat', category: '', teams: 'Team A', quarter: 'Q1 2026' },
      { jira_key: 'I-NT', name: 'no team', category: 'Must', teams: '', quarter: 'Q1 2026' },
    ]);
    setEpics(win, []);

    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    const flagged = result.findings.filter(f => f.code === 'INIT_MISSING_TEAM_OR_CATEGORY');
    expect(flagged).toHaveLength(2);
    for (const f of flagged) {
      expect(f.severity).toBe('WARNING');
      expect(f.category).toBe('Initiative integrity');
      expect(f.locators.some(l => l.kind === 'row')).toBe(true);
    }
  });
});

// ─── AT-4 (code 16): dangling Epic link (WARNING), distinct from orphan ─────
describe('AT-4: an Epic whose Initiative key is non-blank but matches no Initiative is reported as DANGLING_EPIC_LINK (WARNING)', () => {
  it('reports one DANGLING_EPIC_LINK locating the Epic + dangling key, and does NOT also report it as ORPHAN_EPIC', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      { jira_key: 'I-1', name: 'Hist', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' },
      { jira_key: 'I-2', name: 'Target', category: 'Must', teams: 'Team A', quarter: 'Q2 2026' },
    ]);
    // "GHOST" is not in the Initiative key set {I-1, I-2}; the Epic is in scope by
    // quarter, so this is a dangling link, not an out-of-scope or orphan Epic.
    setEpics(win, [
      { _initiative_key: 'GHOST', _tshirt_size: 'M', _quarter: 'Q1 2026', _epic_key: 'EPIC-D' },
    ]);

    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    const flagged = result.findings.filter(f => f.code === 'DANGLING_EPIC_LINK');
    expect(flagged).toHaveLength(1);
    const f = flagged[0];
    expect(f.severity).toBe('WARNING');
    expect(f.category).toBe('Initiative integrity');
    expect(f.locators.some(l => l.kind === 'epic' && l.id === 'EPIC-D')).toBe(true);
    const text = `${f.message} ${f.impact || ''} ${f.locators.map(l => l.id).join(' ')}`;
    expect(text).toContain('GHOST');

    // Disjoint from ORPHAN_EPIC (non-blank link ⇒ never an orphan — I-2).
    const orphans = result.findings.filter(f2 => f2.code === 'ORPHAN_EPIC');
    expect(orphans.flatMap(o => o.locators.map(l => l.id))).not.toContain('EPIC-D');
  });
});

// ─── AT-5 (code 17): target Quarter with zero matching Initiatives (INFO) ───
describe('AT-5: a selected target Quarter that no Initiative falls in is reported as TARGET_QUARTER_NO_INITIATIVES (INFO)', () => {
  it('reports TARGET_QUARTER_NO_INITIATIVES (INFO) for the empty target Quarter, not for the populated one', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      { jira_key: 'I-1', name: 'Hist', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' },
      { jira_key: 'I-2', name: 'Target', category: 'Must', teams: 'Team A', quarter: 'Q2 2026' },
    ]);
    setEpics(win, [
      { _initiative_key: 'I-1', _tshirt_size: 'M', _quarter: 'Q1 2026', _epic_key: 'E1' },
    ]);

    // Q3 2026 is a selected target quarter with no Initiative; Q2 2026 has I-2.
    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026','Q3 2026'])");
    const flagged = result.findings.filter(f => f.code === 'TARGET_QUARTER_NO_INITIATIVES');
    expect(flagged).toHaveLength(1);
    const f = flagged[0];
    expect(f.severity).toBe('INFO');
    expect(f.category).toBe('Initiative integrity');
    expect(f.locators.some(l => l.kind === 'quarter' && l.id === 'Q3 2026')).toBe(true);
    expect(flagged.flatMap(x => x.locators.map(l => l.id))).not.toContain('Q2 2026');
  });
});

// ─── AT-6 (code 18): constant work excluded — Category in no Group (WARNING) ─
describe('AT-6: Constant work excluded because its Category matches no Group is reported as CONSTANT_WORK_EXCLUDED (WARNING)', () => {
  it('reports CONSTANT_WORK_EXCLUDED whose impact PM/rows equal getConstantWorkExcluded(...) for the target quarters (single source)', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      { jira_key: 'I-1', name: 'Hist', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' },
      { jira_key: 'I-2', name: 'Target', category: 'Must', teams: 'Team A', quarter: 'Q2 2026' },
    ]);
    setEpics(win, [
      { _initiative_key: 'I-1', _tshirt_size: 'M', _quarter: 'Q1 2026', _epic_key: 'E1' },
    ]);
    // A single Group "All" whose members are {Must}. The Constant work row's
    // Category "Locked" is in no Group ⇒ excluded from every Group's shift.
    execIn(win, "groupsStore.length = 0; groupsStore.push({ name: 'All', color: '#ccc', members: ['Must'], isProjection: true });");
    setConstantWork(win, [
      { jira_key: 'CW-1', epic_name: 'Locked work', category: 'Locked', team: 'Team A', quarter: 'Q2 2026', tshirt_size: 'M' },
    ]);

    const excluded = evalIn(win, "getConstantWorkExcluded(['Q2 2026'], groupsStore)");
    expect(excluded.rows).toBe(1);
    expect(excluded.pm).toBeGreaterThan(0);

    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026'])");
    const flagged = result.findings.filter(f => f.code === 'CONSTANT_WORK_EXCLUDED');
    expect(flagged).toHaveLength(1);
    const f = flagged[0];
    expect(f.severity).toBe('WARNING');
    expect(f.category).toBe('Constant work');
    const text = `${f.message} ${f.impact || ''}`;
    // Single-source: the reported PM and row count are exactly the helper's values.
    expect(numbersIn(text)).toContain(excluded.rows);
    expect(numbersIn(text)).toContain(excluded.pm);
  });
});
