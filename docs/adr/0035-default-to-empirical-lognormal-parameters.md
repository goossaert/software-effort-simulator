---
status: accepted — supersedes the page-load-default decision of ADR-0026 (the ephemerality decision of ADR-0026 stands)
---
# Default to empirical lognormal parameters on page-load (supersedes ADR-0026's synthetic default)

[ADR-0026](./0026-empirical-lognormal-parameters-mode-toggle.md) introduced the two parallel
per-**T-shirt size** lognormal tables (`T_SHIRT_PARAMS` synthetic, `T_SHIRT_PARAMS_EMPIRICAL`
empirical) and the ephemeral `param-mode` radio that swaps the module-scoped `activeParams`
reference. It made **synthetic** the page-load default — "the documented, reproducible baseline" —
with empirical opt-in. This ADR reverses **only that default**: on page-load the radio's
`empirical` option is now `checked`, its label carries the `.active` highlight, and `activeParams`
initialises to `T_SHIRT_PARAMS_EMPIRICAL`. Synthetic remains a one-click alternative.

We chose empirical-as-default for two reasons. **(1)** The synthetic↔empirical outcome gap is large
in practice, and the operator runs the simulator in empirical mode by intent; under the old
synthetic default, *synthetic* was therefore the mode that silently produced numbers the operator
did not intend whenever they forgot to flip the radio — the exact "silently reports numbers the
user did not intend" failure ADR-0026 sought to avoid, just pointing the other way for this
operator. Defaulting to empirical removes that footgun. **(2)** The empirical calibration is
re-fit as more realised quarters are folded in (ADR-0026 already anticipated this as an additive
revision), so a realised-data-first default is the logically evolving baseline; the synthetic fit
remains available and unchanged as the documented reference.

We deliberately **kept ADR-0026's other decisions intact**: the toggle stays *ephemeral* (no
`localStorage`, no URL param — [ADR-0002](./0002-client-side-only.md)), so a reload now resets to
**empirical** (not synthetic); both tables and their shared key-set invariant are untouched; and
the sidebar **T-shirt size reference** panel still documents the synthetic bands, so
[ADR-0007](./0007-lognormal-effort-distribution.md)'s hand-recompute contract is unaffected (the
panel is band-as-definition, not band-as-current-sampling-window).

## Consequences

- The empirical default inherits empirical's known calibration caveats (single quarter, `n = 36`;
  `L` is `n = 3`; `2XS`/`XL`/`XL+` have no Q1 data and carry the synthetic `(μ, σ)` through, so for
  those three sizes the empirical default is numerically identical to synthetic). This is accepted:
  empirical is the operator's intended baseline and improves over time.
- Reproducibility of a *synthetic* run is unchanged — synthetic is one radio click away and the
  reference panel still anchors the documented bands.
- A returning user now always starts in empirical mode each session (ephemeral reset target moved
  from synthetic to empirical).

## Considered alternatives

- **Persist the last-used mode in `localStorage`** (so the default tracks the user's habit) —
  rejected: re-opens ADR-0026 jointly with ADR-0002's "no implicit state across sessions" rule,
  which stays load-bearing. A fixed empirical default achieves the operator's goal without it.
- **Stamp the active mode onto the Run output** so an empirical-by-default run is unambiguous —
  out of scope here (additive; ADR-0026 already lists it as a future revision).
