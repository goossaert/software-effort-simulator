// Acceptance test for feature 0023 (Error Report tab), Phase 2 — the full
// presentation contract (AC-12 / DC-3; former Phase 6 AT-5).
//
// Drives the real Run path (prepareSimulationData) to produce Data-quality findings
// across MULTIPLE categories and severities, then paints them via the seam
// renderErrorReport(findings) and asserts the DC-3 presentation contract: labelled
// per-category sections, sections ordered ERROR → WARNING → INFO, each finding's
// identifiers shown, and a by-severity count badge. Vocabulary verbatim from
// CONTEXT.md: Error Report, Data-quality finding, Severity, Epic, Quarter.
//
// RED on the current base: the WARNING (ORPHAN_EPIC, code 4) and INFO
// (TARGET_QUARTER_NO_INITIATIVES, code 17) findings are unimplemented, so only the
// ERROR T-shirt-sizing section renders — the multi-category/multi-severity
// assertions fail. (renderErrorReport's mechanics already exist from Phase 1; this
// scenario exercises them across all categories, as the consolidated plan intends.)

import { describe, it, expect } from 'vitest';
import { loadSimulator, evalIn, execIn, csv } from '../harness.js';

const H = ['jira_key', 'name', 'category', 'teams', 'quarter'];

function loadInitiatives(win, rows) {
  execIn(win, `loadInitiativesCSV(${JSON.stringify(csv(rows, H))})`);
}
function setEpics(win, epics) {
  execIn(win, `parsedEpics = ${JSON.stringify(epics)};`);
}

describe('AT-5: a Run producing findings across multiple categories and severities renders the full DC-3 presentation contract', () => {
  it('groups findings into labelled per-category sections ordered ERROR → WARNING → INFO with a by-severity count badge', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      { jira_key: 'I-1', name: 'Hist', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' },
      { jira_key: 'I-2', name: 'Target', category: 'Must', teams: 'Team A', quarter: 'Q2 2026' },
    ]);
    setEpics(win, [
      // ERROR · T-shirt sizing
      { _initiative_key: 'I-1', _tshirt_size: 'XXL', _quarter: 'Q1 2026', _epic_key: 'EPIC-XXL' },
      // WARNING · Scope & calibration (orphan — blank parent)
      { _initiative_key: '', _tshirt_size: 'M', _quarter: 'Q1 2026', _epic_key: 'EPIC-ORPH' },
    ]);

    // Q3 2026 is a selected target Quarter with no Initiative → INFO ·
    // Initiative integrity (TARGET_QUARTER_NO_INITIATIVES).
    const result = evalIn(win, "prepareSimulationData(['Q1 2026'], ['Q2 2026','Q3 2026'])");
    execIn(win, `renderErrorReport(${JSON.stringify(result.findings)})`);

    const panel = win.document.getElementById('tab-error-report');
    expect(panel).not.toBeNull();
    const text = panel.textContent;

    // Three labelled per-category sections are present.
    expect(text).toContain('T-shirt sizing');
    expect(text).toContain('Scope & calibration');
    expect(text).toContain('Initiative integrity');

    // Sections are ordered ERROR → WARNING → INFO (by the severity they contain).
    const iError = text.indexOf('T-shirt sizing');       // contains the ERROR finding
    const iWarn  = text.indexOf('Scope & calibration');  // contains the WARNING finding
    const iInfo  = text.indexOf('Initiative integrity');  // contains the INFO finding
    expect(iError).toBeGreaterThanOrEqual(0);
    expect(iError).toBeLessThan(iWarn);
    expect(iWarn).toBeLessThan(iInfo);

    // Each finding's offending identifier is shown.
    expect(text).toContain('EPIC-XXL');
    expect(text).toContain('EPIC-ORPH');
    expect(text).toContain('Q3 2026');

    // By-severity count badge shows the ERROR/WARNING/INFO totals.
    expect(text).toContain('1 ERROR');
    expect(text).toContain('1 WARNING');
    expect(text).toContain('1 INFO');
  });
});
