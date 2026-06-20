# Backlog migration — config_version 2 → 3

Mechanical layers (converge + transforms) are already applied. The steps below need
your judgment. Paste this whole file into Claude Code at the repo root, or work through
it by hand. `tier: trusted` steps are **operator/root** actions on the out-of-repo
enforcement overlay — a session cannot do them.

> **This repo's actual paths differ from the generic `/opt/backlog/...` examples below.** The
> trusted overlay for `software-effort-simulator` lives at
> `/Users/emmanuel.goossaert@new10.com/code/backlog-enforcement/enforcement.config.json`, and the
> tool at `/Users/emmanuel.goossaert@new10.com/code/backlog` (owned by the `backlog-tool` service
> account). Follow **`docs/backlog-loop-ops.md`** for the exact, repo-specific commands; treat the
> `/opt/backlog` snippets here as illustrative only.

---

## v3 · (Optional) Opt into the contract-assertion floor + set assert_symbols for your language

v3 adds an opt-in contract-assertion floor (gate sub-check g): when `contract.enabled` is true and a
plan declares at least one `[contract]` invariant, the changed production code must contain at least
one runtime assertion or the gate rewinds to `implement`. It is a deliberately WEAK floor — it
confirms the change is not assertion-free, not that the *right* contracts exist — and it is OFF by
default, so no action is needed unless you want it. To adopt it, set `contract.enabled: true` and set
`contract.assert_symbols` to the `|`-alternation of assertion tokens idiomatic to your language
(e.g. `assert|invariant|require`); leaving `assert_symbols` empty falls back to a lenient
language-agnostic built-in set, which may miss your assertion style. This is a repo-local choice
with no enforcement strictness, so it stays in `backlog.config.json`.

---

## v3 · Mutation gate is now ON by default — select an engine (or record a trusted N/A) and scope it with business_logic_globs

v3 ships `mutation.enabled: true` in the template, so a fresh repo's business-logic phases are
mutation-scored by the host gate (it re-runs your engine on a throwaway worktree and FAILs below
`mutation.min_score`, rewinding to `atdd`). But the engine command is empty until grill selects one,
and the forcing rule rejects a business-logic phase that left mutation enabled-without-a-command, or
disabled with no recorded N/A. So you must do ONE of: (a) select a mutation engine in grill (which
populates `mutation.command`), or (b) record a deliberate N/A for the mutation layer. The N/A is the
load-bearing escape hatch and — when a trusted overlay is configured — it is honoured TRUSTED-ONLY
(an in-repo N/A is ignored so a session can't self-certify), so record it root-side:

```console
$ sudo sh -c 'jq ".toolchain.layers.mutation.status=\"n/a\"" /opt/backlog/enforcement.config.json > /opt/backlog/.next && mv /opt/backlog/.next /opt/backlog/enforcement.config.json'
$ sudo chmod 0444 /opt/backlog/enforcement.config.json
```

Separately, if mutation is on, set `mutation.business_logic_globs` to the globs that mark your real
business logic (e.g. `src/**`, not generated/wiring code): with it unset the forcing heuristic
treats ANY changed production file as requiring mutation, so config-only or generated-code commits
will force-reject.

---

## v3 · (Optional) Opt into the oracle-free floor + manufacture a marker convention for metamorphic/differential tests

v3 adds an opt-in oracle-free floor (gate sub-check h): when `oracle_free.enabled` is true, each
plan phase classified `(c) oracle-free` must have a committed test carrying a marker, or the gate
rewinds to `atdd`. Unlike PBT there is no canonical metamorphic/differential test token, so the
marker is a MANUFACTURED convention you invent — a test-name substring, tag, or comment that
stage-atdd places in each `(c)` test and you record here (mirroring `pbt.import_symbol`'s
provenance role). It is OFF by default and is a structural existence floor only (it cannot judge
whether the metamorphic relation is meaningful). To adopt it, set `oracle_free.enabled: true` and
`oracle_free.marker` to your chosen token (e.g. `@metamorphic`); decide and record the convention
during grill so `atdd` and the gate agree. A repo not doing oracle-free testing needs no action.

---

## v3 · Wire the property-based-testing framework (framework + import_symbol) or record a PBT N/A

v3 adds a host PBT structural floor (gate sub-check f): for each non-N/A parametric property your
plan declares, the gate greps committed tests for `pbt.import_symbol` and rewinds to `atdd` if none
is found — and a complementary forcing rule rejects a parametric-property plan when `pbt.enabled` is
false with no recorded N/A. `pbt` is OFF by default, so a stack that should do property testing must
wire it via grill: `pbt.framework` names the human-selected library stage-atdd authors against
(never model-picked), and `pbt.import_symbol` is the exact public API token the gate greps for (it
may be an `a|b` alternation for multi-API frameworks). Pick these in grill's Part B2 (apply-docs
sets `pbt.enabled: true` on install), or — for a stack with no worthwhile PBT library — record a
deliberate N/A for the `pbt` layer (trusted-only when an overlay is configured; same `jq` idiom as
the mutation note, with `.toolchain.layers.pbt.status="n/a"`). Do not leave `pbt.framework` empty
while a plan declares parametric properties: that is a `pbt-framework-unconfigured` block.

---

## v3 · Run grill's toolchain search + select this repo's test toolchain (flips toolchain.selected true)

This is the headline v3 decision. Until `toolchain.selected` is `true`, a real-backend loop will
not run cleanly: it warns at startup (and hard-fails under `--require-toolchain`), and the
post-stage gate's forcing rule rejects any protected phase that left a required mechanical layer
unconfigured with no recorded N/A. Selecting a test toolchain (the PBT / mutation / static-analysis
engines) is a hard-to-reverse, lock-in choice, so a human makes it — not the model. Birth one task
with `/grill` in this repo: grill's Part B2 web-searches the options viable today for your stack
and presents them per layer; you choose each layer or explicitly mark it `N/A — <reason>`. The
autonomous apply-docs phase then installs each library, writes the per-layer commands + the
`toolchain` provenance block, and sets `toolchain.selected: true` last (a failed install is a
`blocked` outcome, never a silent advance). Do not hand-edit `toolchain.*` — run grill so the
selection and the installed manifest/lockfile land together. Afterwards confirm `backlog.config.json`
shows `toolchain.selected: true`, and that `verify_command` / `smoke_command` are real commands for
this repo (not the `npm run verify` placeholder), since both are now re-run by the host gate.

---

## v3 · (Optional) Tune the static-analysis suppression-token scan for your toolchain

v3 wires a suppression-token scan (gate sub-check s2): under `correctness_gate.enabled` the gate
scans the implement commit's ADDED production lines for blanket static-analysis suppressions and
rewinds a hit to `implement`, catching a phase that dodges a layer by sprinkling `@ts-nocheck` /
`# type: ignore` / `eslint-disable` / `# noqa` / `# nolint`. It ships ON with a conservative
built-in alternation, so most repos need no action. Set `correctness_gate.suppression_pattern` only
to override that built-in with an extended-regex alternation tuned to your linters/type-checkers —
to add a tool-specific suppression comment your stack uses, or to narrow it if a legitimate token
causes false rewinds. It is advisory per-project tooling (the master switch already covers turning
the gate off), so it stays in the in-repo config.

---

## v3 · Set the test-runner shuffle flag so the gate's randomized-order pass is real

v3's gate sub-check (b) now re-runs `verify_command` on every one of `stability.green_reruns` runs
PLUS one randomized-order pass that appends `stability.shuffle_flag`, to catch order-dependent /
flaky suites. The flag is runner-specific and empty by default, and when empty the randomized pass
silently degrades to a plain extra rerun with a logged warning — so order-dependence is NOT actually
exercised until you set it. Set `stability.shuffle_flag` to your test runner's randomize argument:
e.g. `-p randomly` (pytest), `--shuffle` (jest), `-shuffle=on` (go test). This is advisory
per-project tooling, not an enforcement escape hatch, so it lives in the in-repo
`backlog.config.json`.

---

## v3 · Deploy + populate the root-owned trusted enforcement overlay (a sandboxed session cannot do this)  ⚠️ TRUSTED (operator/root, out-of-repo overlay)

A sandboxed Claude session CANNOT perform this — only a human operator with root can, because the
overlay must live outside every repo and outside `~/.claude` (which the ai-jail jail maps writable)
and be unwritable by the loop's uid. This out-of-repo, root-owned JSON is the authoritative source
for the gate's enforcement-critical keys, so a phase that commits a weakened in-repo
`backlog.config.json` cannot relax the floor for the next phase. The in-repo `trusted_config_path`
key (default `/opt/backlog/enforcement.config.json`) is operator-discovery only and is never read
for enforcement. Deploy it once, then point the loop at it per run via
`--trusted-config /opt/backlog/enforcement.config.json` (or export `BACKLOG_TRUSTED_CONFIG`) — and
run the loop as the unprivileged session uid, never root, or the fail-closed preflight will
correctly abort. Create and lock it down:

```console
$ sudo install -d -m 0755 -o root /opt/backlog
$ printf '{"gate":{"enabled":true},"correctness_gate":{"enabled":true},"test_immutability":{"readonly_enforcement":"chmod"}}' | sudo tee /opt/backlog/enforcement.config.json >/dev/null
$ sudo chmod 0444 /opt/backlog/enforcement.config.json
$ ls -l /opt/backlog/enforcement.config.json   # expect -r--r--r-- root
```

To pin a strictness knob or record a trusted-only toolchain N/A later (see the mutation/PBT notes),
rotate it in place — edit, then re-assert read-only:

```console
$ sudo sh -c 'jq ".mutation.min_score=80" /opt/backlog/enforcement.config.json > /opt/backlog/.next && mv /opt/backlog/.next /opt/backlog/enforcement.config.json'
$ sudo chmod 0444 /opt/backlog/enforcement.config.json
```
