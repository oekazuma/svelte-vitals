---
'svelte-vitals': patch
---

`--update-suppressions` now writes the suppressions file atomically (temp file + rename), so an interrupted run can no longer leave a corrupt `svelte-vitals-suppressions.json` that fails every later run.
