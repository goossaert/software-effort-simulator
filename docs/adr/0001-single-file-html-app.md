# Single-file HTML app, no build step

The simulator is delivered as one self-contained `index.html` with inline `<style>` and `<script>` blocks; the only external dependencies are Chart.js and PapaParse, loaded from CDN at runtime.

We picked this shape so the tool can be shared as a single file (Slack attachment, email, USB drive) and opened with a double-click on any machine, with zero install or local toolchain. The trade-off is real: no module boundaries, no tree-shaking, no transpilation, and a ~130 KB file that grows monolithically. We accept that — the alternative (Vite + a bundle + a hosted URL) would shift the cost from us (file size) onto every potential user (install, run, trust a URL) and is incompatible with the offline use case.

This decision is hard to reverse only in spirit, not in mechanics: at any point the file can be split, but every consumer who has bookmarked or saved a local copy would need a new distribution channel.
