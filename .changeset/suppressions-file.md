---
'svelte-vitals': minor
---

Add a `svelte-vitals-suppressions.json` file: `--update-suppressions` records every currently-penalized finding once (a persistent adoption ramp, unlike the transient `--baseline <ref>` git-ref comparison), and the file is then applied automatically on every run — after `--diff`/`--staged` and `--baseline` — so gating (`--fail-on`, `--min-health`) can be turned on for an existing project without first fixing its whole backlog. `--no-suppressions` disables it for one run.
