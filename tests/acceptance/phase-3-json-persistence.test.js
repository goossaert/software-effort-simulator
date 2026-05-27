// Acceptance tests for feature 0020, Phase 3: Groups JSON persistence.
//
// Each `describe('AT-N: …')` block maps to one scenario in
// docs/plans/0020-category-and-groups.md, Phase 3 "Acceptance behavior".
//
// Tests target the public seams named in the plan:
//   • `saveGroupsJSON(): void` — serialises groupsStore + triggers download.
//   • `triggerLoadGroupsJSON(): void` — programmatically clicks the hidden
//     `<input type="file" accept=".json">`.
//   • `loadGroupsJSON(text): { ok, error?, groups? }` — parses + validates +
//     normalises the `isProjection` invariant + returns the new groups or an
//     error string.
//   • `confirmLoadGroupsReplacement(loadedGroups): void` — opens the modal
//     if groupsStore is non-trivial, otherwise replaces immediately.
//   • The Groups-tab toolbar buttons (Save groups (JSON), Load groups (JSON)).
//   • The hidden file input element.
//   • `#groups-load-confirm-overlay` confirmation modal DOM.
//   • `#groups-load-error` inline error surface DOM.
//
// Tests do NOT lock in:
//   • exact ids of the hidden file input or the modal beyond their plan-named
//     selector strings;
//   • exact wording of error messages (substring matching only);
//   • exact key order inside serialised Group objects (JSON.parse round-trip
//     compares semantically, not byte-equal);
//   • exact modal layout / button styling.

import { describe, it, expect } from 'vitest';
import { loadSimulator, read, evalIn, execIn, csv } from '../harness.js';

// ─── Fixture helpers ────────────────────────────────────────────────

function loadInitiatives(win, rows, headers) {
  const text = csv(rows, headers);
  execIn(win, `loadInitiativesCSV(${JSON.stringify(text)})`);
}

function sensibleRow(jiraKey, teams, quarter, category) {
  return { jira_key: jiraKey, name: `Init ${jiraKey}`, teams, quarter, category };
}

function setGroups(win, groups) {
  execIn(win, `groupsStore.length = 0; for (const g of ${JSON.stringify(groups)}) groupsStore.push(g);`);
}

function renderGroups(win) {
  execIn(win, 'renderGroupsTab();');
}

// Capture the text that saveGroupsJSON wraps in a Blob. Intercepts the Blob
// constructor inside the page realm so we can read what was about to be
// downloaded without depending on actual file I/O. Restores the originals
// after the call.
function captureSaveText(win) {
  return execIn(win, `
    let _captured = null;
    const _origBlob = window.Blob;
    function _CaptureBlob(parts, opts) {
      _captured = (parts || []).map(function (p) { return String(p); }).join('');
      return new _origBlob(parts, opts);
    }
    window.Blob = _CaptureBlob;
    const _origCreate = URL.createObjectURL;
    URL.createObjectURL = function () { return 'blob:test'; };
    const _origRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = function () {};
    try { saveGroupsJSON(); } finally {
      window.Blob = _origBlob;
      URL.createObjectURL = _origCreate;
      URL.revokeObjectURL = _origRevoke;
    }
    return _captured;
  `);
}

// Call loadGroupsJSON(text) directly and return its result.
function loadResult(win, text) {
  return evalIn(win, `loadGroupsJSON(${JSON.stringify(text)})`);
}

// Find a Groups-tab toolbar button by a substring match on text content.
function findToolbarBtn(win, substring) {
  return Array.from(win.document.querySelectorAll('#tab-groups button'))
    .find(b => b.textContent.includes(substring));
}

// ─── AT-1: toolbar has Save + Load buttons ─────────────────────────
describe('AT-1: Groups tab toolbar has Save and Load JSON buttons', () => {
  it('two buttons mount inside #tab-groups labelled with Save groups (JSON) and Load groups (JSON)', () => {
    const win = loadSimulator();
    setGroups(win, [{ name: 'A', color: '#000', members: [], isProjection: true }]);
    renderGroups(win);

    const saveBtn = findToolbarBtn(win, 'Save groups (JSON)');
    const loadBtn = findToolbarBtn(win, 'Load groups (JSON)');
    expect(saveBtn).toBeTruthy();
    expect(loadBtn).toBeTruthy();
  });
});

// ─── AT-2: clicking Save downloads groups.json with the documented shape ──
describe('AT-2: saveGroupsJSON serialises the documented schema', () => {
  it('happy path: two Groups serialise as { schemaVersion: 1, groups: [...] } with the documented fields', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'A', color: '#ea7c2c', members: ['Must'], isProjection: true },
      { name: 'B', color: '#4f46e5', members: ['Should', null], isProjection: false },
    ]);
    renderGroups(win);

    const text = captureSaveText(win);
    expect(text).toBeTruthy();
    const parsed = JSON.parse(text);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.groups).toHaveLength(2);
    expect(parsed.groups[0]).toMatchObject({
      name: 'A', color: '#ea7c2c', members: ['Must'], isProjection: true,
    });
    expect(parsed.groups[1]).toMatchObject({
      name: 'B', color: '#4f46e5', members: ['Should', null], isProjection: false,
    });
  });

  it('serialised text uses two-space indentation from JSON.stringify(..., null, 2)', () => {
    const win = loadSimulator();
    setGroups(win, [{ name: 'A', color: '#000', members: [], isProjection: true }]);
    renderGroups(win);

    const text = captureSaveText(win);
    // Two-space indent puts top-level keys on indented lines.
    expect(text).toMatch(/\n  "schemaVersion"/);
    expect(text).toMatch(/\n  "groups"/);
  });

  it('the download anchor element targets the filename groups.json (property-style: matches across runs)', () => {
    const win = loadSimulator();
    setGroups(win, [{ name: 'A', color: '#000', members: [], isProjection: true }]);
    renderGroups(win);

    const downloadName = execIn(win, `
      let _name = null;
      const _origCreate = document.createElement.bind(document);
      document.createElement = function (tag) {
        const el = _origCreate(tag);
        if (tag.toLowerCase() === 'a') {
          Object.defineProperty(el, 'download', {
            set: function (v) { _name = v; },
            get: function () { return _name; },
            configurable: true,
          });
        }
        return el;
      };
      const _origBlob = window.Blob;
      const _origUrl = URL.createObjectURL;
      const _origRev = URL.revokeObjectURL;
      URL.createObjectURL = function () { return 'blob:test'; };
      URL.revokeObjectURL = function () {};
      try { saveGroupsJSON(); } finally {
        document.createElement = _origCreate;
        URL.createObjectURL = _origUrl;
        URL.revokeObjectURL = _origRev;
      }
      return _name;
    `);
    expect(downloadName).toBe('groups.json');
  });
});

// ─── AT-3: BLANK sentinel serialises as JSON null ──────────────────
describe('AT-3: the (Blank) sentinel survives save as the JSON null literal', () => {
  it('a member equal to null parses back to null (not "null" or "(Blank)")', () => {
    const win = loadSimulator();
    setGroups(win, [{ name: 'X', color: '#000', members: [null], isProjection: true }]);
    renderGroups(win);

    const text = captureSaveText(win);
    expect(text).toBeTruthy();
    const parsed = JSON.parse(text);
    expect(parsed.groups[0].members).toEqual([null]);
    // Negative-control: the raw text must contain the unquoted `null` token
    // in the members array, not the string forms.
    expect(text).not.toMatch(/"members":\s*\[\s*"\(Blank\)"\s*\]/);
    expect(text).not.toMatch(/"members":\s*\[\s*"BLANK"\s*\]/);
    expect(text).not.toMatch(/"members":\s*\[\s*"null"\s*\]/);
  });
});

// ─── AT-4: empty groupsStore saves "groups": [] ────────────────────
describe('AT-4: saving an empty groupsStore writes an empty groups array', () => {
  it('groupsStore === [] produces { schemaVersion: 1, groups: [] }', () => {
    const win = loadSimulator();
    execIn(win, 'groupsStore.length = 0;');

    const text = captureSaveText(win);
    expect(text).toBeTruthy();
    const parsed = JSON.parse(text);
    expect(parsed).toEqual({ schemaVersion: 1, groups: [] });
  });
});

// ─── AT-5: Load button programmatically clicks the hidden file input ──
describe('AT-5: the hidden JSON file input exists and the Load button triggers it', () => {
  it('there is a single <input type="file" accept=".json"> in the DOM', () => {
    const win = loadSimulator();
    const inputs = win.document.querySelectorAll('input[type="file"][accept=".json"]');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });

  it('clicking the Load groups (JSON) button calls click() on the hidden file input', () => {
    const win = loadSimulator();
    setGroups(win, [{ name: 'A', color: '#000', members: [], isProjection: true }]);
    renderGroups(win);

    const input = win.document.querySelector('input[type="file"][accept=".json"]');
    expect(input).toBeTruthy();
    let clicks = 0;
    input.click = function () { clicks++; };

    const loadBtn = findToolbarBtn(win, 'Load groups (JSON)');
    expect(loadBtn).toBeTruthy();
    loadBtn.click();
    expect(clicks).toBeGreaterThanOrEqual(1);
  });
});

// ─── AT-6: valid schemaVersion:1 file replaces groupsStore ─────────
describe('AT-6: loadGroupsJSON with schemaVersion:1 returns a valid groups array', () => {
  it('happy path: parses the documented schema and returns groups[]', () => {
    const win = loadSimulator();
    const fileText = JSON.stringify({
      schemaVersion: 1,
      groups: [
        { name: 'NewA', color: '#000000', members: ['Must'], isProjection: true },
        { name: 'NewB', color: '#ffffff', members: [null], isProjection: false },
      ],
    });
    const result = loadResult(win, fileText);
    expect(result.ok).toBe(true);
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0]).toMatchObject({
      name: 'NewA', color: '#000000', members: ['Must'], isProjection: true,
    });
    expect(result.groups[1]).toMatchObject({
      name: 'NewB', color: '#ffffff', members: [null], isProjection: false,
    });
  });

  it('wholesale replace: confirmLoadGroupsReplacement on a trivial store writes the new groups verbatim', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'All', color: '#4f46e5', members: ['Automation'], isProjection: true },
    ]);
    renderGroups(win);

    execIn(win, `confirmLoadGroupsReplacement([
      { name: 'NewA', color: '#000000', members: ['Must'], isProjection: true },
      { name: 'NewB', color: '#ffffff', members: [null], isProjection: false },
    ]);`);
    const groups = read(win, 'groupsStore');
    expect(groups).toHaveLength(2);
    expect(groups[0].name).toBe('NewA');
    expect(groups.find(g => g.name === 'All')).toBeUndefined();
  });
});

// ─── AT-7: schemaVersion > 1 → inline error, no replace ────────────
describe('AT-7: a schemaVersion > 1 file is rejected', () => {
  it('loadGroupsJSON returns { ok:false, error contains "newer version" }', () => {
    const win = loadSimulator();
    const result = loadResult(win, JSON.stringify({ schemaVersion: 2, groups: [] }));
    expect(result.ok).toBe(false);
    expect(String(result.error)).toMatch(/newer version/i);
  });

  it('groupsStore is unchanged when a v2 file is processed by the full handler-equivalent flow', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'KR1', color: '#a', members: ['KR1'], isProjection: true },
      { name: 'KR2', color: '#b', members: ['KR2'], isProjection: false },
    ]);
    const before = JSON.stringify(read(win, 'groupsStore'));

    const result = loadResult(win, JSON.stringify({ schemaVersion: 2, groups: [] }));
    expect(result.ok).toBe(false);

    // Even if a caller mistakenly invoked confirmLoadGroupsReplacement with
    // an empty array, we proved above that load returned ok:false — so the
    // store is preserved. Verify the snapshot:
    expect(JSON.stringify(read(win, 'groupsStore'))).toBe(before);
  });
});

// ─── AT-8: missing schemaVersion is treated as 1 ───────────────────
describe('AT-8: a file without schemaVersion loads as schemaVersion 1', () => {
  it('missing schemaVersion → ok:true with the documented fields parsed', () => {
    const win = loadSimulator();
    const text = JSON.stringify({
      groups: [{ name: 'X', color: '#000', members: [], isProjection: true }],
    });
    const result = loadResult(win, text);
    expect(result.ok).toBe(true);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toMatchObject({
      name: 'X', color: '#000', members: [], isProjection: true,
    });
  });
});

// ─── AT-9: malformed JSON → raw parse-error string ─────────────────
describe('AT-9: malformed JSON surfaces a parse error', () => {
  it('a file with invalid JSON returns ok:false with a parse-error string', () => {
    const win = loadSimulator();
    const result = loadResult(win, '{ "schemaVersion": 1, "groups": [unfinished');
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    // The error must look like a parse error (SyntaxError text from JSON.parse).
    expect(String(result.error)).toMatch(/(syntax|json|parse|unexpected|token)/i);
  });
});

// ─── AT-10: wrong top-level shape → inline shape error ─────────────
describe('AT-10: top-level shape that is not an object with "groups" array is rejected', () => {
  it('an array at the top level returns ok:false with a shape error', () => {
    const win = loadSimulator();
    const result = loadResult(win, JSON.stringify([1, 2, 3]));
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(String(result.error)).toMatch(/groups/i);
  });

  it('a string at the top level returns ok:false (negative: bare-string is not an object)', () => {
    const win = loadSimulator();
    const result = loadResult(win, JSON.stringify('hello'));
    expect(result.ok).toBe(false);
  });

  it('a number at the top level returns ok:false (negative)', () => {
    const win = loadSimulator();
    const result = loadResult(win, JSON.stringify(42));
    expect(result.ok).toBe(false);
  });
});

// ─── AT-11: non-trivial groupsStore → confirmation modal ───────────
describe('AT-11: non-trivial groupsStore interposes the confirmation modal', () => {
  it('confirmLoadGroupsReplacement opens #groups-load-confirm-overlay when groupsStore is non-trivial', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'KR1', color: '#a', members: [], isProjection: true },
      { name: 'KR2', color: '#b', members: [], isProjection: false },
      { name: 'KR3', color: '#c', members: [], isProjection: false },
    ]);
    renderGroups(win);

    execIn(win, `confirmLoadGroupsReplacement([
      { name: 'X', color: '#000', members: [], isProjection: true },
    ]);`);

    const overlay = win.document.getElementById('groups-load-confirm-overlay');
    expect(overlay).toBeTruthy();
    // The overlay must be visible (not display:none).
    expect(overlay.style.display).not.toBe('none');
  });

  it('groupsStore is not yet replaced while the modal is open', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'A', color: '#a', members: [], isProjection: true },
      { name: 'B', color: '#b', members: [], isProjection: false },
    ]);
    renderGroups(win);

    execIn(win, `confirmLoadGroupsReplacement([
      { name: 'X', color: '#000', members: [], isProjection: true },
    ]);`);

    // Positive precondition: the modal must have opened (proving the function
    // ran). If the modal does not exist, the function is missing entirely and
    // this test must FAIL — the negative invariant is meaningful only when the
    // modal pathway is engaged.
    const overlay = win.document.getElementById('groups-load-confirm-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.style.display).not.toBe('none');

    const groups = read(win, 'groupsStore');
    expect(groups.map(g => g.name)).toEqual(['A', 'B']);
  });
});

// ─── AT-12: trivial groupsStore (just auto-default `All`) skips modal ──
describe('AT-12: trivial groupsStore skips the confirmation modal', () => {
  it('a single auto-default `All` Group → no modal, replace is immediate', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'All', color: '#4f46e5', members: ['Must', 'Should'], isProjection: true },
    ]);
    renderGroups(win);

    execIn(win, `confirmLoadGroupsReplacement([
      { name: 'NewG', color: '#000', members: ['Must'], isProjection: true },
    ]);`);

    const overlay = win.document.getElementById('groups-load-confirm-overlay');
    // Either the overlay does not exist OR it is not visible.
    if (overlay) expect(overlay.style.display).toBe('none');

    const groups = read(win, 'groupsStore');
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('NewG');
  });

  it('an empty groupsStore also skips the modal (negative: nothing to confirm)', () => {
    const win = loadSimulator();
    execIn(win, 'groupsStore.length = 0;');
    renderGroups(win);

    execIn(win, `confirmLoadGroupsReplacement([
      { name: 'NewG', color: '#000', members: ['Must'], isProjection: true },
    ]);`);

    const overlay = win.document.getElementById('groups-load-confirm-overlay');
    if (overlay) expect(overlay.style.display).toBe('none');
    const groups = read(win, 'groupsStore');
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('NewG');
  });
});

// ─── AT-13: Cancel leaves groupsStore unchanged ────────────────────
describe('AT-13: cancelling the confirmation modal aborts the load', () => {
  it('clicking the modal Cancel button leaves groupsStore unchanged', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'OrigA', color: '#a', members: [], isProjection: true },
      { name: 'OrigB', color: '#b', members: [], isProjection: false },
    ]);
    renderGroups(win);

    execIn(win, `confirmLoadGroupsReplacement([
      { name: 'NewG', color: '#000', members: [], isProjection: true },
    ]);`);

    const overlay = win.document.getElementById('groups-load-confirm-overlay');
    expect(overlay).toBeTruthy();
    // Find the Cancel button inside the overlay.
    const cancelBtn = Array.from(overlay.querySelectorAll('button'))
      .find(b => /cancel/i.test(b.textContent));
    expect(cancelBtn).toBeTruthy();
    cancelBtn.click();

    const groups = read(win, 'groupsStore');
    expect(groups.map(g => g.name)).toEqual(['OrigA', 'OrigB']);
    // The overlay should hide on cancel.
    expect(overlay.style.display).toBe('none');
  });
});

// ─── AT-14: Replace applies the load ───────────────────────────────
describe('AT-14: confirming the modal performs the wholesale replace', () => {
  it('clicking the Replace button writes the loaded groups to groupsStore', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'OldA', color: '#a', members: [], isProjection: true },
      { name: 'OldB', color: '#b', members: [], isProjection: false },
    ]);
    renderGroups(win);

    execIn(win, `confirmLoadGroupsReplacement([
      { name: 'NewG', color: '#000', members: ['Must'], isProjection: true },
    ]);`);

    const overlay = win.document.getElementById('groups-load-confirm-overlay');
    expect(overlay).toBeTruthy();
    const replaceBtn = Array.from(overlay.querySelectorAll('button'))
      .find(b => /replace/i.test(b.textContent));
    expect(replaceBtn).toBeTruthy();
    replaceBtn.click();

    const groups = read(win, 'groupsStore');
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('NewG');
    expect(overlay.style.display).toBe('none');
  });
});

// ─── AT-15: null in JSON members deserialises to BLANK ─────────────
describe('AT-15: a JSON null in members deserialises to the (Blank) sentinel', () => {
  it('members ["Must", null, "Should"] preserves null in the returned groups', () => {
    const win = loadSimulator();
    const text = JSON.stringify({
      schemaVersion: 1,
      groups: [{
        name: 'M',
        color: '#000',
        members: ['Must', null, 'Should'],
        isProjection: true,
      }],
    });
    const result = loadResult(win, text);
    expect(result.ok).toBe(true);
    expect(result.groups[0].members).toEqual(['Must', null, 'Should']);
    // null at index 1, not the string "(Blank)" or "null".
    expect(result.groups[0].members[1]).toBeNull();
  });
});

// ─── AT-16: absent-from-CSV categories are preserved verbatim ──────
describe('AT-16: loaded members referencing absent Categories are preserved verbatim', () => {
  it('a Group whose members reference a CSV-absent Category loads cleanly and silently matches zero at Run', () => {
    const win = loadSimulator();
    loadInitiatives(win, [
      sensibleRow('I-1', 'Team A', 'Q2 2026', 'Automation'),
      sensibleRow('I-2', 'Team A', 'Q2 2026', 'KR1'),
    ], ['jira_key', 'name', 'category', 'teams', 'quarter']);

    const result = loadResult(win, JSON.stringify({
      schemaVersion: 1,
      groups: [{
        name: 'CrossCsv',
        color: '#000',
        members: ['Must'], // absent in this CSV
        isProjection: true,
      }],
    }));
    expect(result.ok).toBe(true);
    expect(result.groups[0].members).toEqual(['Must']);
  });
});

// ─── AT-17: unknown fields are silently dropped ────────────────────
describe('AT-17: unknown fields inside a Group entry are silently ignored', () => {
  it('a Group with an extra futureField parses with only the four documented fields surviving', () => {
    const win = loadSimulator();
    const text = JSON.stringify({
      schemaVersion: 1,
      groups: [{
        name: 'A',
        color: '#000',
        members: [],
        isProjection: true,
        futureField: 'foo',
      }],
    });
    const result = loadResult(win, text);
    expect(result.ok).toBe(true);
    expect(result.groups[0]).toMatchObject({
      name: 'A', color: '#000', members: [], isProjection: true,
    });
    // Unknown fields silently dropped — forward-compat per ADR-0030.
    expect(result.groups[0].futureField).toBeUndefined();
  });
});

// ─── AT-18: applying a load does not trigger a chart re-render ─────
describe('AT-18: loaded Groups commit immediately but chart waits for Run', () => {
  it('confirmLoadGroupsReplacement does not change chartInstance (no Run fired)', () => {
    const win = loadSimulator();
    execIn(win, 'groupsStore.length = 0;');

    const before = evalIn(win, 'typeof chartInstance');
    execIn(win, `confirmLoadGroupsReplacement([
      { name: 'X', color: '#000', members: [], isProjection: true },
    ]);`);
    // Positive precondition: the load must have committed to groupsStore.
    // If the function does not exist, groupsStore stays [] and the negative
    // invariant ("no Run") is vacuously true — strengthen by asserting the
    // replace happened first.
    expect(read(win, 'groupsStore')).toHaveLength(1);
    expect(read(win, 'groupsStore')[0].name).toBe('X');

    const after = evalIn(win, 'typeof chartInstance');
    expect(after).toBe(before);
  });
});

// ─── AT-19: loaded isProjection becomes the new Projection group ───
describe('AT-19: a loaded Group flagged isProjection becomes the Projection group', () => {
  it('after replace, exactly one Group has isProjection===true and it is the loaded one', () => {
    const win = loadSimulator();
    // Setup must be a trivial store (single auto-default `All`) so the
    // confirmation modal does not interpose; the focus of this scenario is the
    // load-time isProjection normalisation, not the modal flow (AT-11..AT-14).
    setGroups(win, [
      { name: 'All', color: '#a', members: [], isProjection: true },
    ]);
    renderGroups(win);

    execIn(win, `confirmLoadGroupsReplacement([
      { name: 'A', color: '#000', members: ['Must'], isProjection: false },
      { name: 'NewProj', color: '#111', members: ['Should'], isProjection: true },
    ]);`);

    const groups = read(win, 'groupsStore');
    const flagged = groups.filter(g => g.isProjection);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].name).toBe('NewProj');
  });
});

// ─── AT-20: two loads in a row are each wholesale-replace ──────────
describe('AT-20: two consecutive loads are each wholesale-replace', () => {
  it('second load wins; first load is gone', () => {
    const win = loadSimulator();
    execIn(win, 'groupsStore.length = 0;');

    execIn(win, `confirmLoadGroupsReplacement([
      { name: 'A1', color: '#000', members: ['Must'], isProjection: true },
    ]);`);
    expect(read(win, 'groupsStore').map(g => g.name)).toEqual(['A1']);

    // After the first load the store holds a single non-`All` Group, so the
    // second load is non-trivial per the plan and the confirmation modal
    // interposes. Simulate the user clicking Replace to drive the actual
    // wholesale-replace path the scenario is verifying.
    execIn(win, `confirmLoadGroupsReplacement([
      { name: 'B1', color: '#111', members: ['Should'], isProjection: true },
      { name: 'B2', color: '#222', members: ['Could'], isProjection: false },
    ]);`);
    const overlay = win.document.getElementById('groups-load-confirm-overlay');
    const replaceBtn = Array.from(overlay.querySelectorAll('button'))
      .find(b => /replace/i.test(b.textContent));
    replaceBtn.click();
    expect(read(win, 'groupsStore').map(g => g.name)).toEqual(['B1', 'B2']);
  });
});

// ─── AT-21: Save reachable with empty groupsStore ──────────────────
describe('AT-21: Save works even when groupsStore is empty', () => {
  it('saveGroupsJSON on empty store writes { groups: [] } without error', () => {
    const win = loadSimulator();
    execIn(win, 'groupsStore.length = 0;');
    renderGroups(win);

    const text = captureSaveText(win);
    const parsed = JSON.parse(text);
    expect(parsed.groups).toEqual([]);
  });
});

// ─── AT-22: Load reachable any time (incl. before any CSV load) ────
describe('AT-22: Load is reachable before any Initiatives CSV has been loaded', () => {
  it('loadGroupsJSON returns ok:true with no CSV loaded and no editedInitiatives', () => {
    const win = loadSimulator();
    expect(read(win, 'parsedInitiatives')).toBeNull();

    const result = loadResult(win, JSON.stringify({
      schemaVersion: 1,
      groups: [
        { name: 'PreCsv', color: '#000', members: ['Must'], isProjection: true },
      ],
    }));
    expect(result.ok).toBe(true);
    expect(result.groups[0].name).toBe('PreCsv');
  });
});

// ─── AT-23: missing groups field → shape error ─────────────────────
describe('AT-23: a file with no `groups` field is rejected', () => {
  it('{ schemaVersion:1 } returns ok:false and the error mentions "groups"', () => {
    const win = loadSimulator();
    const result = loadResult(win, JSON.stringify({ schemaVersion: 1 }));
    expect(result.ok).toBe(false);
    expect(String(result.error)).toMatch(/groups/i);
  });
});

// ─── AT-24: wrong members shape → shape error ──────────────────────
describe('AT-24: a Group with members of the wrong type is rejected', () => {
  it('members: "not an array" returns ok:false', () => {
    const win = loadSimulator();
    const result = loadResult(win, JSON.stringify({
      schemaVersion: 1,
      groups: [
        { name: 'X', color: '#000', members: 'not an array', isProjection: true },
      ],
    }));
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('members: 42 also returns ok:false (negative: number is not array)', () => {
    const win = loadSimulator();
    const result = loadResult(win, JSON.stringify({
      schemaVersion: 1,
      groups: [
        { name: 'X', color: '#000', members: 42, isProjection: true },
      ],
    }));
    expect(result.ok).toBe(false);
  });
});

// ─── AT-25: multiple isProjection:true → first wins ────────────────
describe('AT-25: a file with multiple isProjection:true normalises to exactly one', () => {
  it('three groups all flagged true → first survives, rest demoted', () => {
    const win = loadSimulator();
    const result = loadResult(win, JSON.stringify({
      schemaVersion: 1,
      groups: [
        { name: 'G1', color: '#000', members: [], isProjection: true },
        { name: 'G2', color: '#111', members: [], isProjection: true },
        { name: 'G3', color: '#222', members: [], isProjection: true },
      ],
    }));
    expect(result.ok).toBe(true);
    expect(result.groups.map(g => g.isProjection)).toEqual([true, false, false]);
  });
});

// ─── AT-26: zero isProjection:true → first promoted ────────────────
describe('AT-26: a file with zero isProjection:true normalises to first-by-default', () => {
  it('three groups all flagged false → first promoted to true', () => {
    const win = loadSimulator();
    const result = loadResult(win, JSON.stringify({
      schemaVersion: 1,
      groups: [
        { name: 'G1', color: '#000', members: [], isProjection: false },
        { name: 'G2', color: '#111', members: [], isProjection: false },
        { name: 'G3', color: '#222', members: [], isProjection: false },
      ],
    }));
    expect(result.ok).toBe(true);
    expect(result.groups.map(g => g.isProjection)).toEqual([true, false, false]);
  });
});

// ─── AT-27: groups: [] sets groupsStore = [] ───────────────────────
describe('AT-27: a file with empty groups array empties the store', () => {
  it('loading { groups: [] } and confirming sets groupsStore = []', () => {
    const win = loadSimulator();
    setGroups(win, [
      { name: 'All', color: '#4f46e5', members: ['Must'], isProjection: true },
    ]);

    const result = loadResult(win, JSON.stringify({ schemaVersion: 1, groups: [] }));
    expect(result.ok).toBe(true);
    expect(result.groups).toEqual([]);

    execIn(win, `confirmLoadGroupsReplacement([]);`);
    expect(read(win, 'groupsStore')).toEqual([]);
  });
});

// ─── AT-28: save + load round-trip ─────────────────────────────────
describe('AT-28: save-then-load round-trip preserves groupsStore semantically', () => {
  it('mixed members (strings + BLANK) and varied colors / projection flag survive round-trip', () => {
    const win = loadSimulator();
    const originalGroups = [
      { name: 'Must',   color: '#ea7c2c', members: ['Must'],                   isProjection: false },
      { name: 'MS',     color: '#4f46e5', members: ['Must', 'Should'],         isProjection: true  },
      { name: 'Empty',  color: '#10b981', members: [],                         isProjection: false },
      { name: 'Blank',  color: '#a855f7', members: [null, '📊 Analytics'],     isProjection: false },
    ];
    setGroups(win, originalGroups);

    const text = captureSaveText(win);
    expect(text).toBeTruthy();

    // Reset state and load.
    execIn(win, 'groupsStore.length = 0;');
    const result = loadResult(win, text);
    expect(result.ok).toBe(true);
    expect(result.groups).toEqual(originalGroups);
  });
});

// ─── AT-29: inline error clears on subsequent success ──────────────
describe('AT-29: a successful load clears any pre-existing inline error', () => {
  it('after a parse error followed by a success, #groups-load-error is hidden', () => {
    const win = loadSimulator();
    setGroups(win, [{ name: 'A', color: '#000', members: [], isProjection: true }]);
    renderGroups(win);

    // Simulate the file-change handler's effect for a bad file by writing
    // the error to the surface manually — the seam under test is "clear on
    // success", not "set on failure".
    execIn(win, `
      const el = document.getElementById('groups-load-error');
      if (el) { el.textContent = 'A previous parse error.'; el.style.display = 'block'; }
    `);
    // Confirm setup worked.
    const errEl = win.document.getElementById('groups-load-error');
    expect(errEl).toBeTruthy();
    expect(errEl.style.display).not.toBe('none');

    // Now a successful load.
    execIn(win, `confirmLoadGroupsReplacement([
      { name: 'X', color: '#000', members: [], isProjection: true },
    ]);`);

    // The inline error surface must be hidden (display:none) or empty.
    const after = win.document.getElementById('groups-load-error');
    const isHidden = after.style.display === 'none' || after.textContent.trim() === '';
    expect(isHidden).toBe(true);
  });
});

// ─── AT-30: Save and Load never trigger a Run ──────────────────────
describe('AT-30: Save and Load actions never trigger a Run', () => {
  it('saveGroupsJSON does not invoke runSimulation, and the save still happens', () => {
    const win = loadSimulator();
    setGroups(win, [{ name: 'A', color: '#000', members: [], isProjection: true }]);

    // Spy on runSimulation.
    const spy = execIn(win, `
      let _calls = 0;
      const _orig = runSimulation;
      runSimulation = function () { _calls++; return _orig.apply(this, arguments); };
      return { get: function () { return _calls; }, restore: function () { runSimulation = _orig; } };
    `);

    const text = captureSaveText(win);
    // Positive precondition: save actually happened (we have text out).
    // Without this, the negative invariant is vacuous when saveGroupsJSON
    // doesn't exist.
    expect(text).toBeTruthy();
    expect(spy.get()).toBe(0);
    spy.restore();
  });

  it('confirmLoadGroupsReplacement does not invoke runSimulation, and the replace still happens', () => {
    const win = loadSimulator();
    execIn(win, 'groupsStore.length = 0;');

    const spy = execIn(win, `
      let _calls = 0;
      const _orig = runSimulation;
      runSimulation = function () { _calls++; return _orig.apply(this, arguments); };
      return { get: function () { return _calls; }, restore: function () { runSimulation = _orig; } };
    `);

    execIn(win, `confirmLoadGroupsReplacement([
      { name: 'X', color: '#000', members: [], isProjection: true },
    ]);`);
    // Positive precondition: the replace happened.
    expect(read(win, 'groupsStore')).toHaveLength(1);
    expect(spy.get()).toBe(0);
    spy.restore();
  });
});
