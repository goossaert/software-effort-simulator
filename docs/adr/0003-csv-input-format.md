# CSV as the input format, not a Jira API integration

Users feed the simulator by uploading CSV files exported from Jira (or any other tool); the app does not call the Jira REST API, does not require API tokens, and does not know about Jira at all beyond recognising the Jira-key regex (`^[A-Z][A-Z0-9_]+-\d+$`) as a content cue during column auto-detection.

We chose CSV because: (a) the simulator is client-side only ([ADR-0002](./0002-client-side-only.md)) and cannot hold Jira credentials safely; (b) users frequently want to forecast *hypothetical* states — "what if we move INIT-42 from Could to Must" — which is trivial to do by editing a CSV but awkward against a live API; and (c) CSVs let the tool work with any planning system (Linear, Asana, spreadsheets) that can export the required columns. The cost is friction: every Run starts with a re-export, and CSV exports drift in shape over time, which is why column detection has to scan values rather than trust headers (giving rise to the **sensible**-vs-**quirky** format distinction recorded in `CONTEXT.md`).

A future "live Jira" mode would not replace this — it would sit alongside it.
