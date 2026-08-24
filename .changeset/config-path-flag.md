---
'svelte-vitals': minor
---

Add `--config <path>`: analyze under the config file at that path instead of the one discovered in the analyzed directory. Discovery is skipped rather than merged, a relative path resolves against the directory the command runs in rather than the analyzed one (so `svelte-vitals apps/web --config shared/sv.config.js` works from a repo root), `.js` and `.ts` are the only accepted extensions, and a missing or unreadable file exits `2`.
