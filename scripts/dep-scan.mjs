#!/usr/bin/env node
// Dependency-vulnerability scan (the backlog `dep_scan` correctness layer).
//
// ENGINE: `npm audit` (npm built-in) — unchanged. This thin wrapper exists ONLY to
// record the "accepted exception" the apply-docs heads-up explicitly authorises for
// PRE-EXISTING advisories that:
//   (a) are unrelated to the change under test,
//   (b) are fixable only by a one-way-door MAJOR upgrade the operator deliberately
//       refused — here, moving off vitest 2.x (see commits 4c263d0 / ebc51ab, where
//       @fast-check/vitest was re-pinned to 0.3.0 precisely to STAY on vitest 2.x),
//   (c) are not exploitable in this repo's usage (a single static index.html tested
//       headlessly via `vitest run` — no dev server, no UI server is ever started).
// Every OTHER high/critical advisory — in any dependency, including any NEW one — still
// fails the scan, exactly like the bare `npm audit --audit-level=high` it replaces.
// npm has no native advisory-allowlist, so this wrapper IS the recorded exception.
//
// REVIEW THIS LIST whenever vitest is upgraded off 2.x: each entry should then be
// removable because the upstream fix becomes available without a refused major bump.
const ALLOWLIST = new Map([
  ["GHSA-fx2h-pf6j-xcff",
    "vite `server.fs.deny` bypass (Windows alternate paths) — affects the vite DEV SERVER only; this repo never starts it (headless `vitest run`). Fix requires vite 6.x ⇒ a vitest major upgrade (refused)."],
  ["GHSA-5xrq-8626-4rwp",
    "vitest UI-server arbitrary file read/exec — only when `vitest --ui` is LISTENING; the loop only ever runs `vitest run`. Fix requires vitest 3.2.6+/4.x ⇒ a refused major upgrade."],
]);

import { execFileSync } from "node:child_process";

const BLOCKING = new Set(["high", "critical"]); // == `npm audit --audit-level=high`

let raw;
try {
  // `npm audit` exits non-zero when advisories exist; capture its stdout regardless.
  raw = execFileSync("npm", ["audit", "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch (e) {
  raw = (e.stdout && e.stdout.toString()) || "";
}

let report;
try {
  report = JSON.parse(raw);
} catch {
  console.error("dep-scan: FAIL — could not parse `npm audit --json` output (audit could not run).");
  process.exit(2);
}

const offending = new Set();
const accepted = new Set();
for (const [pkg, v] of Object.entries(report.vulnerabilities || {})) {
  for (const via of v.via || []) {
    if (typeof via !== "object" || !via.url) continue;      // skip transitive string refs
    if (!BLOCKING.has(via.severity)) continue;              // only high/critical
    const id = String(via.url).split("/").pop();            // trailing GHSA id
    const line = `${via.severity}\t${pkg} via ${id}\t${via.title || ""}`;
    if (ALLOWLIST.has(id)) accepted.add(`${line}\n      reason: ${ALLOWLIST.get(id)}`);
    else offending.add(line);
  }
}

if (accepted.size) {
  console.log("dep-scan: accepted (documented) high/critical advisories:");
  for (const a of accepted) console.log("  ACCEPTED " + a);
}
if (offending.size) {
  console.error("dep-scan: FAIL — non-allowlisted high/critical advisories:");
  for (const o of offending) console.error("  " + o);
  process.exit(1);
}
console.log("dep-scan: PASS — no non-allowlisted high/critical advisories.");
process.exit(0);
