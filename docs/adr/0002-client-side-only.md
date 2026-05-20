# Client-side only, no backend

All parsing, simulation, charting, and state live in the browser; the app makes no network calls other than the initial CDN fetches for Chart.js and PapaParse. Uploaded CSVs are read via `FileReader` and never leave the user's machine.

We made this choice because the input data — Jira exports of unreleased initiatives, team capacity assumptions, MoSCoW priorities — is treated by users as confidential roadmap information that they will not paste into a hosted service. A no-backend design removes the conversation about data handling, audit logging, retention, and authentication entirely. The cost is that anything requiring shared state (saved scenarios, team accounts, cross-user comparisons) cannot exist without revisiting this decision.

Together with [ADR-0001](./0001-single-file-html-app.md), this also means there is no server to operate: the artifact is the application.
