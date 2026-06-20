# Backlog loop — operations (v3, external topology)

This repo is driven by the **external** `backlog` tool (v3), not a submodule. The submodule
`tools/backlog` was removed; the config was migrated to `config_version: 3`. This note records how
to launch the loop and how the integrity assets are deployed, so nobody falls back to the deleted
submodule path.

> Migration record: see `BACKLOG-MIGRATION-2-to-3.md` (the coalesced v3 checklist) in the repo root.

## Topology

| Asset | Path | Owner | Mode | Why |
|---|---|---|---|---|
| External tool | `/Users/emmanuel.goossaert@new10.com/code/backlog` | `backlog-tool` (service acct) | dirs `0755`, bins `0755` | Sibling of this repo, outside it and outside `~/.claude`. Owned by a uid the loop can't write, so a session can't edit its own judge. |
| Trusted overlay | `/Users/emmanuel.goossaert@new10.com/code/backlog-enforcement/enforcement.config.json` | `backlog-tool` | `0444` | Authoritative source for the gate's enforcement-critical keys. The in-repo `trusted_config_path` key is **discovery-only** and is never read for enforcement. |
| This repo | `/Users/emmanuel.goossaert@new10.com/code/software-effort-simulator` | you | — | The only thing the ai-jail sandbox maps **writable** (`--rw-map "$repo"`). |
| Loop uid | your normal login user | — | — | **Never** run the loop as root or as `backlog-tool` — the fail-closed preflight checks the assets are *not writable by the running uid*; a privileged owner running the loop would (correctly) abort it. |

Integrity comes from **loop uid ≠ asset owner uid**, not from root specifically (verified in the
tool's `lib/sandbox.sh` → `sandbox_assert_assets`: it asserts the overlay and the external tool are
outside `$REPO`, outside `~/.claude`, and `! [ -w ]` by the running uid — it never tests for root).

## Daily launch (run as your normal user)

```bash
backlog-loop --repo /Users/emmanuel.goossaert@new10.com/code/software-effort-simulator \
             --trusted-config /Users/emmanuel.goossaert@new10.com/code/backlog-enforcement/enforcement.config.json
# Optional hardening flags:
#   --require-tool-version    refuse to run if the tool drifted from the recorded tool_commit
#   --require-config-version  refuse to run if config_version is behind the tool schema
#   --require-toolchain       hard-fail (not just warn) until the test toolchain is selected (see below)
```

`backlog-loop` is on `PATH` via a `…/code/backlog/bin` entry (see setup). If it is not on your PATH,
invoke it by full path: `/Users/emmanuel.goossaert@new10.com/code/backlog/bin/backlog-loop …`.

## One-time setup (operator / root)

A sandboxed session cannot do these — they need `sudo` and must happen outside the jail. Run once.

### 1. Create the login-disabled service account that owns the tool + overlay

```bash
# Pick an unused service UID (600 here); no-login shell; hidden from the login screen.
sudo sysadminctl -addUser backlog-tool -fullName "Backlog tool owner" -UID 600 -shell /usr/bin/false
sudo dscl . -create /Users/backlog-tool IsHidden 1
id backlog-tool   # confirm it exists
```

### 2. Hand the existing tool checkout to that account (no copy — it already lives here at f53f1b8)

```bash
TOOL=/Users/emmanuel.goossaert@new10.com/code/backlog
sudo chown -R backlog-tool "$TOOL"
sudo find "$TOOL" -type d -exec chmod 0755 {} \;
```

> Tradeoff: after this, editing the backlog tool yourself needs `sudo` (it's owned by `backlog-tool`).
> That is the point — your loop uid can no longer rewrite its judge.

### 3. Put `backlog-loop` on PATH — **do NOT use `ln -s` symlinks**

The launcher resolves its libs from `BASH_SOURCE[0]` **without** `readlink -f`, so a symlink in
`/usr/local/bin` would make it look for `lib/` next to the *symlink* and fail. Use one of:

```bash
# Option A (no sudo): add the bin dir to your PATH — backlog-loop then resolves to the real path.
echo 'export PATH="$PATH:/Users/emmanuel.goossaert@new10.com/code/backlog/bin"' >> ~/.zshrc

# Option B (sudo): exec-wrappers in /usr/local/bin (they invoke the REAL path, so libs resolve).
for b in backlog-loop backlog-migrate backlog-init backlog-watch; do
  printf '#!/bin/sh\nexec /Users/emmanuel.goossaert@new10.com/code/backlog/bin/%s "$@"\n' "$b" \
    | sudo tee /usr/local/bin/$b >/dev/null && sudo chmod 0755 /usr/local/bin/$b
done
```

### 4. Deploy + lock the trusted enforcement overlay

```bash
OVERLAY=/Users/emmanuel.goossaert@new10.com/code/backlog-enforcement/enforcement.config.json
sudo install -d -m 0755 -o backlog-tool "$(dirname "$OVERLAY")"
printf '{"gate":{"enabled":true},"correctness_gate":{"enabled":true},"test_immutability":{"readonly_enforcement":"chmod"}}' \
  | sudo tee "$OVERLAY" >/dev/null
sudo chown backlog-tool "$OVERLAY"
sudo chmod 0444 "$OVERLAY"
```

If you decide to keep `mutation` and/or `pbt` **off** (see the toolchain step), their N/A escape
hatches are honored **trusted-only** (an in-repo N/A is ignored so a session can't self-certify) —
record them in the overlay, rotating in place and re-asserting read-only:

```bash
OVERLAY=/Users/emmanuel.goossaert@new10.com/code/backlog-enforcement/enforcement.config.json
sudo sh -c "jq '.toolchain.layers.mutation.status=\"n/a\" | .toolchain.layers.pbt.status=\"n/a\"' \
  '$OVERLAY' > '$OVERLAY.next' && mv '$OVERLAY.next' '$OVERLAY'"
sudo chown backlog-tool "$OVERLAY"; sudo chmod 0444 "$OVERLAY"
```

### 5. Verify ownership + writability (run as your NORMAL user, not root, not backlog-tool)

```bash
TOOL=/Users/emmanuel.goossaert@new10.com/code/backlog
OVERLAY=/Users/emmanuel.goossaert@new10.com/code/backlog-enforcement/enforcement.config.json
ls -ld "$TOOL" "$TOOL/bin/backlog-loop"            # owner = backlog-tool, dirs 0755
ls -l  "$OVERLAY"                                  # -r--r--r-- owned by backlog-tool
git -C "$TOOL" rev-parse HEAD                       # f53f1b80751e43b1fa2ec3b8cd36d992a6610ed2
grep BACKLOG_SCHEMA_VERSION= "$TOOL/lib/common.sh"  # ...:-3}
[ -w "$TOOL/bin/backlog-loop" ] && echo "TOOL WRITABLE — FAIL" || echo "tool not writable by you — OK"
[ -w "$OVERLAY" ]               && echo "OVERLAY WRITABLE — FAIL" || echo "overlay not writable by you — OK"
```

## Validation smoke test — exercises the fail-closed preflight

**Run this only AFTER one-time setup steps 1–4 are complete.** The preflight's first act is to
assert the overlay *exists* and is locked down, so it dies before anything else if the overlay is
missing.

First, a pre-overlay sanity check that PATH + lib resolution work (omitting `--trusted-config` makes
the preflight a documented no-op, so this is safe even before the overlay exists):

```bash
backlog-loop --repo /Users/emmanuel.goossaert@new10.com/code/software-effort-simulator --until-idle
# Expect: "Backlog loop starting …" then "no ready tasks — exiting (--until-idle)" (0021 is done).
```

Then the real integrity check. The preflight runs **only on a real launch** (`DRY_RUN -eq 0`), so
`--dry-run` does **not** exercise it — use `--until-idle`:

```bash
backlog-loop --repo /Users/emmanuel.goossaert@new10.com/code/software-effort-simulator \
             --trusted-config /Users/emmanuel.goossaert@new10.com/code/backlog-enforcement/enforcement.config.json \
             --until-idle
# PASS:        "Backlog loop starting …" then "no ready tasks — exiting (--until-idle)".
# FAIL "trusted config not found":          the overlay isn't deployed yet — finish setup step 4.
# FAIL "… is writable by the current uid":  the tool/overlay are still owned by you, or you ran as
#                                           root/backlog-tool — redo the chown (steps 2 & 4) and run
#                                           as your normal user.
```

## Pending: select the test toolchain (the headline v3 decision)

`toolchain.selected` is still `false`, so the loop **warns** at startup and the gate will
force-reject protected phases (`implement` / `review` / `review-correctness`) until either the
toolchain is selected or each layer is recorded N/A. This is a deliberate human decision and must
**not** be hand-edited into `toolchain.*`. Birth one task with `/grill` in this repo: its Part B2
web-searches engines viable for this stack (browser/HTML + `vitest` + `eslint` + `ast-grep`) — e.g.
a JS PBT lib like `fast-check`, a mutation engine like StrykerJS — installs them with lockfiles, and
the autonomous `apply-docs` phase writes the per-layer commands and flips `toolchain.selected: true`.

- `verify_command: npm run verify` is already a **real** composite (`eslint index.html` +
  `ast-grep scan` + `vitest run`), not a placeholder — leave it.
- `mutation.enabled` is `false` (preserved from v2). Either enable + wire an engine via grill, or
  record the trusted N/A above. `pbt` similarly.
- `stability.shuffle_flag` is empty (randomized-order pass degrades to a plain rerun with a warning).
  For vitest, `-- --sequence.shuffle` is the candidate flag; validate it during the grill toolchain
  step since `verify_command` is a composite.

## Rollback

The repo-side upgrade is on branch `chore/backlog-v3-external`. To abandon:
`git switch main && git branch -D chore/backlog-v3-external`. The external assets are independent of
the repo; remove them with **literal** paths (never an unset `$VAR` with `rm -rf`):

```bash
sudo rm -rf /Users/emmanuel.goossaert@new10.com/code/backlog-enforcement   # the overlay only
sudo sysadminctl -deleteUser backlog-tool                                  # the service account
# The tool checkout stays at /Users/emmanuel.goossaert@new10.com/code/backlog (you keep it there);
# if you deleted the service account, chown it back to yourself:
#   sudo chown -R "$(id -un)" /Users/emmanuel.goossaert@new10.com/code/backlog
```
