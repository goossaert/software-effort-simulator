# Two-file Initiative/Epic model, not a single flat file

Inputs are split into two CSVs: one row per **Initiative** (carrying MoSCoW, team, quarter, name, key) and one row per **Epic** (carrying t-shirt size, parent **Initiative key**, quarter). The two are joined client-side via the Initiative key column.

The split mirrors the actual domain shape and Jira's own export semantics: in Jira, Initiatives and Epics are different issue types with different fields, exported by different JQL queries. Forcing them into one file would require either denormalising (one row per epic, MoSCoW/team repeated — which obscures the **Initiative**-level counts that drive Poisson λ) or nesting (impossible in CSV). Keeping them separate also lets users edit one side without touching the other, and lets the **Constant Work CSV** (a later feature) follow the same join pattern.

The cost is that loading is gated on *both* files being present (the Run button is disabled until then), and column auto-detection has to run twice with different rules — which is why the legacy "quirky" format support and the link-column detector live in the codebase. We accept this complexity as the price of matching the domain.
