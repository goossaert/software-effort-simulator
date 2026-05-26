// Harness for loading index.html in JSDOM with stubbed CDN dependencies.
//
// The app is a single-file HTML per ADR-0001. To exercise its in-script
// definitions (engine functions, module-scoped state like `groupsStore`)
// without modifying the source, we:
//   1. Read index.html.
//   2. Strip the CDN <script src="…cdn…"> tags (JSDOM can't fetch them).
//   3. Inject an inline <script> at the top of <head> that defines `window.Chart`
//      and `window.Papa` stubs before any of the page's inline scripts run.
//   4. Hand the rewritten HTML to JSDOM with `runScripts: 'dangerously'`.
//
// JSDOM then executes every inline `<script>` block as a real top-level script
// in its V8 vm context, so `let`/`const`/`class` declarations are registered in
// the page's global lexical environment exactly as they would be in a browser,
// not isolated per-block (which is what happens when you call `window.eval()`
// repeatedly from outside).

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const INDEX_HTML = path.resolve(here, '..', 'index.html');

const CDN_SCRIPT_RE = /<script\b[^>]*\bsrc\s*=[^>]*>\s*<\/script>/gi;

const STUB_SCRIPT = `<script>
(function () {
  function Chart(_canvas, config) {
    this.data = (config && config.data) || { datasets: [] };
    this.options = (config && config.options) || {};
  }
  Chart.prototype.destroy = function () {};
  Chart.prototype.update = function () {};
  Chart.prototype.resize = function () {};
  Chart.register = function () {};
  Chart.helpers = {};
  Chart.defaults = { font: {}, plugins: {} };
  window.Chart = Chart;

  window.Papa = {
    parse: function (text, opts) {
      opts = opts || {};
      var norm = String(text || '').replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n');
      var lines = norm.split('\\n');
      while (lines.length && lines[lines.length - 1] === '') lines.pop();
      if (!lines.length) return { data: [], errors: [], meta: { fields: [] } };
      var headerLine = lines.shift();
      var headers = headerLine.split(',').map(function (h) { return h.trim(); });
      var data = lines.map(function (line) {
        var cells = line.split(',');
        if (opts.header) {
          var obj = {};
          headers.forEach(function (h, i) { obj[h] = (cells[i] == null ? '' : cells[i]).trim(); });
          return obj;
        }
        return cells.map(function (c) { return (c == null ? '' : c).trim(); });
      });
      return { data: data, errors: [], meta: { fields: headers } };
    },
    unparse: function (rows) {
      if (!Array.isArray(rows) || !rows.length) return '';
      var headers = Object.keys(rows[0]);
      var head = headers.join(',');
      var body = rows.map(function (r) {
        return headers.map(function (h) { return r[h] == null ? '' : String(r[h]); }).join(',');
      }).join('\\n');
      return head + '\\n' + body;
    },
  };

  // Some PRNG seeders touch crypto.getRandomValues.
  if (!window.crypto || !window.crypto.getRandomValues) {
    window.crypto = {
      getRandomValues: function (arr) {
        for (var i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
        return arr;
      },
    };
  }

  // Expose a helper to read top-level lexical bindings (let/const/class) by
  // name. The harness installs this BEFORE any page script runs, so tests can
  // later call window.__getBinding('groupsStore') from outside the realm.
  // The trick: we eval the name string from a position INSIDE the global
  // lexical scope (i.e. a function defined at top level of this script). Direct
  // eval inside such a function falls through to the global lexical env, which
  // is where the page's let/const/class bindings live.
  window.__readBinding = function (name) {
    try {
      // eslint-disable-next-line no-eval
      return (0, eval)(name);
    } catch (_) {
      return undefined;
    }
  };
  window.__typeofBinding = function (name) {
    try {
      // eslint-disable-next-line no-eval
      return (0, eval)('typeof ' + name);
    } catch (_) {
      return 'undefined';
    }
  };
})();
</script>`;

function stripCdnScripts(html) {
  return html.replace(CDN_SCRIPT_RE, '');
}

function injectStub(html) {
  // Insert just after <head> so it runs before any page-defined script.
  return html.replace(/<head\b[^>]*>/i, (m) => `${m}\n${STUB_SCRIPT}`);
}

/**
 * Load the simulator's index.html into a JSDOM window. Returns the JSDOM
 * window object; tests reach lexical bindings via `read(win, 'name')` or
 * `evalIn(win, 'expr')`.
 *
 * @param {object} [opts]
 * @param {string} [opts.html] — override page HTML (defaults to index.html).
 * @returns {Window}
 */
export function loadSimulator(opts = {}) {
  const raw = opts.html ?? fs.readFileSync(INDEX_HTML, 'utf8');
  const html = injectStub(stripCdnScripts(raw));

  const virtualConsole = new VirtualConsole();
  virtualConsole.sendTo(console, { omitJSDOMErrors: false });

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/',
    virtualConsole,
  });

  // Bridge typed-array primordials from Node's realm into the JSDOM realm so
  // test assertions like `expect(arr).toBeInstanceOf(Float64Array)` succeed
  // when `arr` was constructed inside the page. JSDOM's `js-globals.json`
  // installs its own typed-array constructors on the window by default, which
  // would otherwise make cross-realm `instanceof` checks return false.
  dom.window.Float64Array = Float64Array;

  return dom.window;
}

/**
 * Read a top-level binding by name from a loaded simulator window. Works for
 * `let`/`const`/`class` (lexical) as well as `function` declarations. Returns
 * `undefined` if the name does not resolve in the page realm.
 */
export function read(win, name) {
  if (typeof win.__readBinding !== 'function') return undefined;
  return win.__readBinding(name);
}

/**
 * `typeof <name>` evaluated against the page realm. Returns `'undefined'` for
 * unresolved names (instead of throwing `ReferenceError`).
 */
export function typeOf(win, name) {
  if (typeof win.__typeofBinding !== 'function') return 'undefined';
  return win.__typeofBinding(name);
}

/**
 * Evaluate arbitrary expression-or-statement code in the page realm. The eval
 * runs as a direct eval inside a function defined at top level of the stub
 * script, so it sees the page's global lexical environment. Use this to mutate
 * `let`-declared state (e.g. `groupsStore.push(...)`) or to call named
 * functions with literal arguments.
 */
export function evalIn(win, code) {
  if (typeof win.__readBinding !== 'function') {
    throw new Error('loadSimulator stub did not install __readBinding helper');
  }
  return win.__readBinding(`(function(){ return (${code}); })()`);
}

/**
 * Convenience for `evalIn(win, code)` where `code` is a statement (not an
 * expression). Wraps in a function body so `return` is not required.
 */
export function execIn(win, code) {
  if (typeof win.__readBinding !== 'function') {
    throw new Error('loadSimulator stub did not install __readBinding helper');
  }
  return win.__readBinding(`(function(){ ${code} })()`);
}

/**
 * Build a CSV string from an array of row objects + optional explicit header
 * order. Tests use this to construct minimal Initiatives / Constant Work CSVs
 * without fighting PapaParse's quoting rules.
 */
export function csv(rows, headers) {
  if (!rows.length && !headers) return '';
  const cols = headers || Object.keys(rows[0]);
  const head = cols.join(',');
  if (!rows.length) return head;
  const body = rows.map(r => cols.map(c => (r[c] ?? '').toString()).join(',')).join('\n');
  return `${head}\n${body}`;
}
