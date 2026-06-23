// Property tests for feature 0023 (Error Report tab), Phase 2 — presentation &
// multi-quarter (former Phase 6 "Properties / invariants to PBT"):
//   (1) renderErrorReport groups findings into per-category sections, orders sections
//       AND findings ERROR→WARNING→INFO, and the by-severity badge counts match.
//   (2) MQ_FORWARD_DOUBLE_COUNT flags exactly the Initiative keys whose normalised
//       key appears in >= 2 distinct selected target quarters, and the engine's
//       kPerGroup is unchanged by the presence of the finding (I-1).
//
// PBT framework: fast-check via @fast-check/vitest `test.prop`; shrinking ON.
//
// Property (1) exercises renderErrorReport, whose mechanics shipped in Phase 1, so it
// is GREEN on the current base — it is a regression guard for the DC-3 contract the
// implement phase must preserve. Property (2) targets code 19 (unimplemented), so it
// is RED on the current base; the combined `0023-phase-2-prop` command therefore
// exits non-zero (stable RED).

import { describe, it, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { loadSimulator, evalIn, execIn, csv } from '../harness.js';

const H = ['jira_key', 'name', 'category', 'teams', 'quarter'];
const SEV_ORDER = { ERROR: 0, WARNING: 1, INFO: 2 };

// ─── PROPERTY 1: render ordering + badge (DC-3) ─────────────────────────────
describe('0023 Phase 2 — renderErrorReport orders sections/findings ERROR→WARNING→INFO with a matching by-severity badge', () => {
  const FINDING = fc.record({
    code: fc.constantFrom('AAA', 'BBB', 'CCC'),
    severity: fc.constantFrom('ERROR', 'WARNING', 'INFO'),
    category: fc.constantFrom('Cat1', 'Cat2', 'Cat3'),
    id: fc.constantFrom('id1', 'id2', 'id3'),
  });

  test.prop([fc.array(FINDING, { maxLength: 20 })], { numRuns: 40 })(
    'renders every finding, sections ordered by severity, findings within a section in severity order, badge counts match',
    (specs) => {
      const win = loadSimulator();
      const findings = specs.map(s => ({
        code: s.code, severity: s.severity, category: s.category,
        locators: [{ kind: 'item', id: s.id }], impact: '', message: `msg-${s.code}`,
      }));
      execIn(win, `renderErrorReport(${JSON.stringify(findings)})`);
      const panel = win.document.getElementById('tab-error-report');
      expect(panel).not.toBeNull();

      if (findings.length === 0) {
        expect(panel.textContent).toContain('No data issues detected.');
        expect(panel.querySelectorAll('strong')).toHaveLength(0);
        return;
      }

      // One <strong> per finding (the severity label); sections are <h3>.
      const allStrongs = [...panel.querySelectorAll('strong')];
      expect(allStrongs).toHaveLength(findings.length);

      // Per-section ordering + section ordering by min severity rank.
      const sections = [...panel.querySelectorAll('h3')].map(h3 => h3.parentElement);
      const sectionMinRanks = [];
      let renderedTotal = 0;
      for (const sec of sections) {
        const sevs = [...sec.querySelectorAll('strong')].map(s => SEV_ORDER[s.textContent]);
        expect(sevs.length).toBeGreaterThan(0);
        renderedTotal += sevs.length;
        for (let i = 1; i < sevs.length; i++) expect(sevs[i]).toBeGreaterThanOrEqual(sevs[i - 1]);
        sectionMinRanks.push(Math.min(...sevs));
      }
      expect(renderedTotal).toBe(findings.length);
      for (let i = 1; i < sectionMinRanks.length; i++) {
        expect(sectionMinRanks[i]).toBeGreaterThanOrEqual(sectionMinRanks[i - 1]);
      }

      // Badge: nonzero per-severity counts are shown.
      const text = panel.textContent;
      const counts = { ERROR: 0, WARNING: 0, INFO: 0 };
      for (const f of findings) counts[f.severity]++;
      for (const sev of ['ERROR', 'WARNING', 'INFO']) {
        if (counts[sev] > 0) expect(text).toContain(`${counts[sev]} ${sev}`);
      }
    },
  );
});

// ─── PROPERTY 2: MQ_FORWARD_DOUBLE_COUNT + kPerGroup unchanged (I-1) ─────────
describe('0023 Phase 2 — MQ_FORWARD_DOUBLE_COUNT flags exactly the keys spanning >= 2 target quarters, engine kPerGroup unchanged', () => {
  const TARGET = ['Q2 2026', 'Q3 2026', 'Q4 2026'];

  test.prop([
    fc.array(
      fc.record({
        key: fc.constantFrom('M-1', ' M-1 ', 'S-1', 'S-2'),
        q: fc.constantFrom('Q2 2026', 'Q3 2026', 'Q4 2026'),
      }),
      { maxLength: 10 },
    ),
  ], { numRuns: 40 })(
    'flags exactly the normalised keys appearing in >= 2 distinct target quarters, leaving kPerGroup intact',
    (rows) => {
      const win = loadSimulator();
      // Baseline load sets detectedCols; then install raw (untrimmed) rows directly.
      execIn(win, `loadInitiativesCSV(${JSON.stringify(csv([
        { jira_key: 'BASE', name: 'base', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' },
      ], H))})`);
      const inits = [{ jira_key: 'I-1', name: 'hist', category: 'Must', teams: 'Team A', quarter: 'Q1 2026' }];
      rows.forEach((r, i) => inits.push({ jira_key: r.key, name: `t${i}`, category: 'Must', teams: 'Team A', quarter: r.q }));
      execIn(win, `editedInitiatives = ${JSON.stringify(inits)};`);
      execIn(win, 'parsedEpics = [];');

      const TSET = new Set(TARGET);
      const byKey = new Map();
      for (const r of rows) {
        const k = r.key.trim(); const q = r.q.trim();
        if (!TSET.has(q)) continue;
        if (!byKey.has(k)) byKey.set(k, new Set());
        byKey.get(k).add(q);
      }
      const expectedMQ = new Set([...byKey].filter(([, qs]) => qs.size >= 2).map(([k]) => k));

      const result = evalIn(win, `prepareSimulationData(['Q1 2026'], ${JSON.stringify(TARGET)})`);
      expect(Array.isArray(result.findings)).toBe(true);

      const flagged = result.findings.filter(f => f.code === 'MQ_FORWARD_DOUBLE_COUNT');
      const flaggedKeys = new Set(flagged.flatMap(f => f.locators.filter(l => l.kind === 'initiative').map(l => (l.id || '').trim())));
      expect([...flaggedKeys].sort()).toEqual([...expectedMQ].sort());

      // I-1: collecting the finding does not alter the engine's kPerGroup.
      const indep = evalIn(win, `(function(){ const { categoryCol } = detectedCols; const ti = editedInitiatives.filter(r => ${JSON.stringify(TARGET)}.includes((r.quarter || '').trim())); return bucketRowsByGroups(ti, categoryCol).kPerGroup; })()`);
      expect(result.kPerGroup).toEqual(indep);
    },
  );
});
