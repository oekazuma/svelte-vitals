---
'@svelte-vitals/action': minor
---

Apply `svelte-vitals-suppressions.json` in the GitHub Action gate, matching the CLI: when the file is present in the repo it's applied automatically (no new input needed), and suppressed/stale-entry counts are logged as job warnings. Previously the action ignored this file entirely, so projects that adopted suppressions locally still had their whole backlog re-surface in Action-based CI.
