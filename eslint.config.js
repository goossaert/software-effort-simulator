// ESLint flat config — the static-correctness `lint` layer for the backlog loop's
// post-stage verification gate (correctness_gate.lint_command / analysis_command).
//
// The production app is index.html: ~4.6k lines across 10 separate <script> blocks that
// share one global namespace at runtime, with many functions invoked from inline HTML
// handlers (e.g. onclick="deleteGroup(...)"). eslint-plugin-html lints each <script>
// block in isolation and cannot see inline-handler references, so `no-undef` (cross-block
// calls) and `no-unused-vars` (definitions consumed in another block or from HTML) yield
// only false positives here — enforcing them would force deleting load-bearing code.
// They are therefore disabled for index.html; the rest of js.configs.recommended (the
// real logic-bug rules: no-dupe-keys, no-unreachable, use-isnan, valid-typeof, …) stays
// on. Empty catch blocks are an intentional defensive idiom in this app, so they're
// allowed; every other empty block is still an error.
import js from "@eslint/js";
import html from "eslint-plugin-html";
import security from "eslint-plugin-security";
import globals from "globals";

export default [
  js.configs.recommended,
  // SAST layer (backlog correctness_gate.sast_command). eslint-plugin-security's
  // recommended ruleset folds the static-security checks (eval, unsafe-regex, child
  // process, non-literal fs/require, …) into the same `npm run lint` the lint layer runs.
  security.configs.recommended,
  {
    files: ["index.html"],
    plugins: { html },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: globals.browser,
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      // detect-object-injection is the canonical false positive for this app's
      // per-size param-table lookups (activeParams[sizeLabel], T_SHIRT_PARAMS[size],
      // T_SHIRT_PARAMS_EMPIRICAL[...]): the keys are normalized t-shirt sizes, never
      // attacker-controlled. Disable ONLY this rule, not the whole security preset.
      "security/detect-object-injection": "off",
    },
  },
];
