// Sanity check: the Monte Carlo engine's simulated mean per scenario should
// equal `K × λ × E[size] + fixedEffort` within Monte Carlo noise, where:
//   λ          — Poisson rate the engine computes from the historical epic pool
//   E[size]    — mean of `tshirtToPersonMonths(size)` over that pool (i.e. the
//                expected lognormal effort per epic under the active param set)
//   K          — per-Group initiative count for the target quarters
//   fixedEffort — sum of constant-work person-months for the target quarters
//
// See handoff-run-sanity-check.md for the full prompt. We use the **Empirical
// Lognormal Parameters** path (`T_SHIRT_PARAMS_EMPIRICAL`) to mirror the UI
// run that motivated this check.
//
// CSV paths are read from environment variables so reviewers can point the
// test at different snapshots without editing code:
//   SIM_INITIATIVES_CSV   — initiatives CSV
//   SIM_EPICS_CSV         — epics CSV (Q1/Q2/Q3 2026)
//   SIM_CONSTANT_WORK_CSV — constant-work CSV
// Defaults match the three files attached in the handoff (~/Downloads/…).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { loadSimulator, read, evalIn, execIn } from '../harness.js';

const HOME = os.homedir();
const INITIATIVES_CSV = process.env.SIM_INITIATIVES_CSV
  || path.join(HOME, 'Downloads', 'initiatives_q3.csv');
const EPICS_CSV = process.env.SIM_EPICS_CSV
  || path.join(HOME, 'Downloads', 'Epics Q1 Q2 Q3 2026.csv');
const CONSTANT_WORK_CSV = process.env.SIM_CONSTANT_WORK_CSV
  || path.join(
       HOME, 'Downloads',
       'data for simulation of April 9th', 'constant_work.csv',
     );

// This is a manual, local-only sanity check driven by personal CSV snapshots
// (defaults under ~/Downloads, overridable via SIM_*_CSV). It cannot run in a
// clean checkout or a sandbox where those files are absent, so it self-skips
// rather than fail the automated suite (`npm run verify`). Provide the three
// CSVs (or set the env vars) to exercise it. See handoff-run-sanity-check.md.
const SANITY_CSVS_MISSING =
  [INITIATIVES_CSV, EPICS_CSV, CONSTANT_WORK_CSV].some(p => !fs.existsSync(p));

// ─── Tiny RFC-4180-ish CSV parser ──────────────────────────────────
// Handles quoted fields with internal commas. The harness's Papa stub does a
// naive split on commas and would garble rows whose values quote a comma
// (e.g. timestamps like "May 13, 2026, 4:34 PM" in the epics CSV, or category
// names like "Repayment types (including irregular, balloon …)" in the
// initiatives CSV). We parse in Node, then re-serialise stripped of any
// internal commas before handing the text to `loadInitiativesCSV` /
// `loadConstantWorkCSV`.
function parseCsvText(text) {
  const lines = [];
  let cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { inQ = !inQ; cur += c; continue; }
    if (c === '\n' && !inQ) { lines.push(cur); cur = ''; continue; }
    if (c === '\r' && !inQ) continue;
    cur += c;
  }
  if (cur.length) lines.push(cur);
  const parseRow = line => {
    const cells = [];
    let cell = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') { cell += '"'; i++; continue; }
        q = !q;
        continue;
      }
      if (ch === ',' && !q) { cells.push(cell); cell = ''; continue; }
      cell += ch;
    }
    cells.push(cell);
    return cells;
  };
  if (lines.length === 0) return { header: [], rows: [] };
  const header = parseRow(lines[0]).map(h => h.trim());
  const rows = lines.slice(1).filter(l => l.length).map(line => {
    const cells = parseRow(line);
    const o = {};
    header.forEach((h, i) => { o[h] = (cells[i] == null ? '' : cells[i]).trim(); });
    return o;
  });
  return { header, rows };
}

function rebuildSafeCsv(rows, columns) {
  const head = columns.join(',');
  const sanitize = s => String(s).replace(/,/g, ' ');
  const body = rows.map(r => columns.map(c => sanitize(r[c] ?? '')).join(',')).join('\n');
  return head + '\n' + body;
}

// ─── Engine-mirroring λ computation (independent of the engine) ────
// Reproduces the logic around prepareSimulationData's `epicCounts` Map so we
// can verify that the engine's `lambda` equals an independently-computed one.
// If these diverge, the bug is in the engine's λ; if they agree but simulated
// mean does not match `K × λ × E[size]`, the bug is in the Monte Carlo loop.
function computeLambdaIndependently(histQs, initRows, epicState, tshirtParamsKeys) {
  const histQSet = new Set(histQs);
  const histInits = initRows.filter(r => histQSet.has((r.quarter || '').trim()));

  // quartersWithEpicData: histQs that actually carry tagged epics.
  const quartersWithEpicData = new Set();
  for (const e of epicState) {
    if (e._quarter && histQSet.has(e._quarter)) quartersWithEpicData.add(e._quarter);
  }

  // histKeys: every initiative in histInits (used for the no-_quarter epic
  // inScope test, not for the denominator).
  const histKeys = new Set(histInits.map(r => (r.jira_key || '').trim()).filter(Boolean));

  // Seed epicCounts with histInits whose quarter has epic data loaded.
  const epicCounts = new Map();
  for (const r of histInits) {
    const initQ = (r.quarter || '').trim();
    if (!quartersWithEpicData.has(initQ)) continue;
    const key = (r.jira_key || '').trim();
    if (key) epicCounts.set(key, 0);
  }

  // Add in-scope epics' contributions (and discover standalone initiative keys).
  let sizedInScope = 0;
  for (const e of epicState) {
    const link = e._initiative_key;
    const epicQ = e._quarter;
    const inScope = epicQ ? histQSet.has(epicQ) : histKeys.has(link);
    if (!inScope || !link) continue;
    if (!epicCounts.has(link)) epicCounts.set(link, 0);
    const size = (e._tshirt_size || '').trim().toUpperCase();
    if (tshirtParamsKeys.has(size)) {
      epicCounts.set(link, epicCounts.get(link) + 1);
      sizedInScope++;
    }
  }

  const denom = epicCounts.size;
  return {
    lambda: denom ? sizedInScope / denom : 0,
    sizedInScope,
    uniqueInitiativeKeys: denom,
  };
}

// ─── Test setup ────────────────────────────────────────────────────
const TARGET_QUARTERS = ['Q3 2026', 'Q4 2026', 'Q1 2027', 'Q2 2027', 'Q3 2027'];
const CAPACITY = 270;
const ITERATIONS = 10000;
const REL_ERROR_THRESHOLD_PCT = 1.5;
const GROUPS = [
  { name: 'BK-only',    color: '#4f46e5', members: ['BK migration'],                            isProjection: false },
  { name: 'BK+ZK',      color: '#dd6b20', members: ['BK migration', 'ZK/RC'],                   isProjection: false },
  { name: 'BK+Auto',    color: '#059669', members: ['BK migration', 'Automation'],              isProjection: false },
  { name: 'BK+ZK+Auto', color: '#ea7c2c', members: ['BK migration', 'ZK/RC', 'Automation'],     isProjection: true  },
];
const HIST_SELECTIONS = [
  ['Q1 2026'],
  ['Q2 2026'],
  ['Q1 2026', 'Q2 2026'],                  // case A in the bug report
  ['Q1 2026', 'Q2 2026', 'Q3 2026'],       // case B in the bug report
];

describe('Sanity check: simulated mean ≈ K × λ × E[size] + fixedEffort', () => {
  it.skipIf(SANITY_CSVS_MISSING)(
    'rel_error per scenario stays within ±1.5 % across 4 historical pools × 4 scenarios',
    () => {
      // ── Pre-flight: required CSVs are present ──────────────────
      for (const p of [INITIATIVES_CSV, EPICS_CSV, CONSTANT_WORK_CSV]) {
        if (!fs.existsSync(p)) {
          throw new Error(
            `Required input CSV not found: ${p}\n` +
            `Set SIM_INITIATIVES_CSV / SIM_EPICS_CSV / SIM_CONSTANT_WORK_CSV ` +
            `to point at the three files described in handoff-run-sanity-check.md.`
          );
        }
      }

      // ── Parse the CSVs in Node ────────────────────────────────
      const inits = parseCsvText(fs.readFileSync(INITIATIVES_CSV, 'utf8'));
      const epics = parseCsvText(fs.readFileSync(EPICS_CSV, 'utf8'));
      const cw    = parseCsvText(fs.readFileSync(CONSTANT_WORK_CSV, 'utf8'));

      // ── Load the simulator page ───────────────────────────────
      const win = loadSimulator();

      // The columns the engine reads from initiatives_q3.csv. Drop the
      // date-y / link-y columns (which contain commas the harness can't
      // un-quote) and keep the ones detectInitKeyCol / detectCategoryCol /
      // detectTeamCol / detectKrCol need.
      const INIT_COLS = ['quarter', 'jira_key', 'initiative', 'kr', 'category', 'teams', 'committed_(yes_or_no)'];
      execIn(win, `loadInitiativesCSV(${JSON.stringify(rebuildSafeCsv(inits.rows, INIT_COLS))})`);

      // Constant-work CSV → fed verbatim (no quoted commas in the data).
      const CW_COLS = ['team', 'key_result', 'epic_name', 'tshirt_size', 'quarter', 'moscow'];
      execIn(win, `loadConstantWorkCSV(${JSON.stringify(rebuildSafeCsv(cw.rows, CW_COLS))})`);

      // Epics: bypass `loadEpicsFile` (which expects a File object) and inject
      // the four synthetic fields the engine actually reads.
      const epicState = epics.rows.map((r, i) => ({
        _initiative_key: (r['initiative key'] || '').trim(),
        _tshirt_size:    (r['T-shirt size']   || '').trim(),
        _quarter:        (r.target_quarter    || '').trim(),
        _epic_key:       (r.key               || `EPIC-${i + 1}`).trim(),
      }));
      execIn(win, `parsedEpics = ${JSON.stringify(epicState)};`);

      // Switch to the Empirical Lognormal Parameters path used in the UI run.
      execIn(win, 'activeParams = T_SHIRT_PARAMS_EMPIRICAL;');
      const T_SHIRT_PARAMS = read(win, 'T_SHIRT_PARAMS');
      const tshirtKeys = new Set(Object.keys(T_SHIRT_PARAMS));

      // Replace the auto-default `All` group with the 4 scenario groups.
      execIn(win, `groupsStore.length = 0; for (const g of ${JSON.stringify(GROUPS)}) groupsStore.push(g);`);

      // ── Build size-to-mean lookup using the engine's tshirtToPersonMonths.
      // This gives us the per-size lognormal mean under the *active* params,
      // so E[size] = mean(tshirtToPersonMonths(s)) over s ∈ epicSizingDist
      // reflects the empirical bias correction whenever the empirical path
      // is selected.
      const sizeToPM = {};
      for (const k of tshirtKeys) {
        sizeToPM[k] = evalIn(win, `tshirtToPersonMonths(${JSON.stringify(k)})`);
      }

      const meanOverPool = (pool) => {
        if (!pool.length) return 0;
        let s = 0;
        for (const sz of pool) s += sizeToPM[sz] ?? 0;
        return s / pool.length;
      };

      // ── Run the simulation 4× and collect per-scenario rows ──
      const rows = [];
      const aggregates = [];
      for (const histQs of HIST_SELECTIONS) {
        const sim = evalIn(win, `(function(){
          const p = prepareSimulationData(${JSON.stringify(histQs)}, ${JSON.stringify(TARGET_QUARTERS)});
          const fe = getConstantWorkEffort(${JSON.stringify(TARGET_QUARTERS)});
          return {
            lambda: p.lambda,
            epicSizingDist: p.epicSizingDist,
            kPerGroup: p.kPerGroup,
            fixedEffort: fe,
          };
        })()`);

        const indep = computeLambdaIndependently(histQs, inits.rows, epicState, tshirtKeys);
        const expSize = meanOverPool(sim.epicSizingDist);

        const groupsSnap = GROUPS.slice();
        const result = evalIn(win, `runSimulation({
          lambda: ${sim.lambda},
          epicSizingDist: ${JSON.stringify(sim.epicSizingDist)},
          kPerGroup: ${JSON.stringify(sim.kPerGroup)},
          groups: ${JSON.stringify(groupsSnap)},
          capacity: ${CAPACITY},
          iterations: ${ITERATIONS},
          fixedEffort: ${sim.fixedEffort},
        })`);

        aggregates.push({
          historical_pool: histQs.join(' + '),
          lambda_engine: sim.lambda,
          lambda_independent: indep.lambda,
          epicSizingCount: sim.epicSizingDist.length,
          expSize,
          fixedEffort: sim.fixedEffort,
        });

        for (let gi = 0; gi < GROUPS.length; gi++) {
          const K = sim.kPerGroup[gi];
          const predicted = K * sim.lambda * expSize + sim.fixedEffort;
          const simulated = result.results[gi].stats.mean;
          const relErrPct = predicted === 0
            ? 0
            : (simulated - predicted) / predicted * 100;
          rows.push({
            historical_pool: histQs.join(' + '),
            scenario: GROUPS[gi].name,
            K, lambda: sim.lambda, expSize,
            fixedEffort: sim.fixedEffort,
            predicted, simulated,
            rel_error_pct: relErrPct,
          });
        }
      }

      // ── Print the aggregate table (one row per historical pool) ─
      console.log('\nλ and E[size] per historical pool (Empirical Lognormal path)');
      console.log(
        ['historical_pool'.padEnd(28),
         'λ_engine'.padStart(10),
         'λ_indep'.padStart(10),
         'epics'.padStart(7),
         'E[size]'.padStart(8),
         'CW(PM)'.padStart(8),
        ].join(' | ')
      );
      console.log('-'.repeat(80));
      for (const a of aggregates) {
        console.log([
          a.historical_pool.padEnd(28),
          a.lambda_engine.toFixed(4).padStart(10),
          a.lambda_independent.toFixed(4).padStart(10),
          String(a.epicSizingCount).padStart(7),
          a.expSize.toFixed(4).padStart(8),
          a.fixedEffort.toFixed(2).padStart(8),
        ].join(' | '));
      }

      // ── Print the per-scenario comparison table (16 rows) ───
      console.log('\nPredicted vs simulated mean per scenario (10 000 iterations)');
      const header = [
        'historical_pool'.padEnd(28),
        'scenario'.padEnd(12),
        'K'.padStart(4),
        'predicted'.padStart(11),
        'simulated'.padStart(11),
        'rel_err%'.padStart(9),
      ].join(' | ');
      console.log(header);
      console.log('-'.repeat(header.length));
      for (const r of rows) {
        console.log([
          r.historical_pool.padEnd(28),
          r.scenario.padEnd(12),
          String(r.K).padStart(4),
          r.predicted.toFixed(2).padStart(11),
          r.simulated.toFixed(2).padStart(11),
          r.rel_error_pct.toFixed(3).padStart(9),
        ].join(' | '));
      }
      console.log();

      // ── Verdict ──────────────────────────────────────────────
      // (a) λ_engine must equal λ_independent (the engine's λ is a re-derivation
      //     of the same identity, so any mismatch indicates a missing branch in
      //     either implementation — the standalone-epics path is the usual
      //     suspect).
      for (const a of aggregates) {
        expect(a.lambda_engine).toBeCloseTo(a.lambda_independent, 9);
      }

      // (b) the K × λ × E[size] identity must hold for every scenario within
      //     the slack the handoff allows.
      const worst = rows
        .map(r => Math.abs(r.rel_error_pct))
        .reduce((a, b) => Math.max(a, b), 0);
      console.log(`Worst |rel_error_pct| across 16 scenarios: ${worst.toFixed(3)} %  (threshold ${REL_ERROR_THRESHOLD_PCT} %)`);

      for (const r of rows) {
        expect(
          Math.abs(r.rel_error_pct),
          `${r.historical_pool} / ${r.scenario}: predicted=${r.predicted.toFixed(2)} simulated=${r.simulated.toFixed(2)}`
        ).toBeLessThan(REL_ERROR_THRESHOLD_PCT);
      }
    },
    /* per-test timeout */ 120_000,
  );
});
