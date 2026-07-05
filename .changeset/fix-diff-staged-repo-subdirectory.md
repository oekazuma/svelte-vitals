---
'svelte-vitals': patch
---

Fix `--diff`/`--staged` silently reporting zero findings when the analyzed project is not at the git repository root (monorepos): git paths are now resolved relative to the analyzed directory.
