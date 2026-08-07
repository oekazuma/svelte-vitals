---
'svelte-vitals': patch
---

Reject flag-shaped and empty values on every CLI string flag (`--meta-components`, `--treat-dynamic-as`, `--route`, `--fail-on`, `--reporter`, `--rules`, `--ignore`, `--min-health`, `--out-file`, `--weights`, `--category`), matching the existing `--baseline` guard. Previously `--route --staged` silently consumed `--staged` as the route value (dropping it from the run), and `--min-health=` (e.g. from an unset CI environment variable) coerced to `0`, turning a health gate into one that could never fail. Both shapes now exit 2 with a clear error instead of silently proceeding. `--min-health` validation moved from `bin.ts` into `resolveArgs` alongside every other flag; `--diff` keeps its existing bare/empty-defaults-to-`HEAD` behavior.
