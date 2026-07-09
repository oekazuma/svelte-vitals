---
'@svelte-vitals/core': patch
---

The Markdown reporter's findings table (used for the GitHub Actions job summary and sticky PR comment) now appends each finding's `recommendation` to its message, matching what the console/github/agent reporters already show. Previously the table only showed the terse `message` (e.g. "Missing robots.txt"), dropping the actionable "how to fix it" text.
