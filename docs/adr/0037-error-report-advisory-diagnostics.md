# 37. Error Report tab — advisory, post-Run data-quality diagnostics collected in the Run path

Date: 2026-06-22

## Status

Accepted

## Context

The simulator silently drops or coerces several classes of bad or missing input,
and the operator cannot see any of it from the CSVs alone:

- An unrecognised / typo t-shirt size maps to 0 PM (`tshirtToPersonMonths`,
  index.html:1341-1345) and is excluded from both Poisson λ and the bootstrap pool
  (the `T_SHIRT_PARAMS[size]` guards, ~index.html:2087-2104); for constant work it
  silently contributes 0 PM.
- An epic with neither an in-scope quarter tag nor an in-scope initiative link is
  excluded from λ (the `!inScope || !link` site, ~index.html:2084); an orphan epic
  (empty parent) is unhandled.
- A selected historical quarter with initiatives but no loaded epics has its
  initiatives excluded from the λ denominator (the `quartersWithEpicData` filter,
  ~index.html:2061-2073).
- Duplicate initiative keys and quarter-label variants are unhandled and distort
  counts.
- λ = 0 and total K = 0 only `console.warn` (~index.html:4566, ~4570); capacity and
  iterations are silently coerced/clamped (~index.html:4540-4542); constant-work
  rows whose category matches no Group are silently excluded.
- An initiative spanning N target quarters is counted ~N× because target K counts
  per-row/quarter (`bucketRowsByGroups` ~index.html:2005; ~index.html:2108) while
  historical λ counts per unique initiative key (~index.html:2081-2089).

These distortions silently bias the forecast. We need to surface them without
changing the simulation's behaviour.

## Decision

1. Add a new **Error Report** results tab (slug `error-report`, last in the tab bar)
   that lists detected data-quality findings after a Run.

2. Findings are collected by **instrumenting the actual Run path**
   (`prepareSimulationData` and the run handler) at the exact points where data is
   excluded or coerced — the report is a by-product of one real Run, so it can never
   disagree with what the simulation computed. It is NOT an independent
   re-derivation of the inputs.

3. The report is **advisory only**: it never aborts or alters a Run, and the
   simulation output is identical whether or not diagnostics are collected. The two
   existing hard stops (the "No sized epics found for historical quarter(s)" throw at
   ~index.html:4556, and the `initiativesLoaded && epicsLoaded` + ≥1 historical + ≥1
   target preconditions) are unchanged. The report covers only Runs that **complete**;
   a fatal Run keeps today's error message.

4. Each finding carries a **severity** ∈ {`ERROR`, `WARNING`, `INFO`} and a stable
   `code`, displays the offending identifier(s), and quantifies impact where possible.

5. Known-but-unfixed model issues are **surfaced, not fixed**. In particular the
   multi-quarter forward double-count is reported at `ERROR`; the underlying
   per-key-vs-per-row unit-consistency fix is a separate future task. If/when that fix
   lands, this finding drops to `INFO`.

## Consequences

- Operators get an actionable, faithful account of what the simulator silently did to
  their data, and the report shares one source of truth with the simulation.
- Additive: no migration, no persistence, no backend (consistent with ADR-0001
  single-file HTML and ADR-0002 client-side-only).
- The report cannot explain a **fatal** Run (it does not render when the Run throws);
  the worst all-unmapped case is left to the existing throw message, which already
  names the offending historical quarter.
- Surfacing the multi-quarter double-count as `ERROR` while leaving the engine math
  unchanged means the report intentionally flags a bug the tool itself still commits,
  until the separate unit-consistency task lands.
- Instrumentation touches a hot path (`prepareSimulationData`); collection must be
  cheap and side-effect-free to preserve the "output identical with/without
  diagnostics" invariant.
