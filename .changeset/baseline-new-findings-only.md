---
'svelte-vitals': minor
---

Add `--baseline <ref>` to report only findings newly introduced compared to a git ref (e.g. `--baseline origin/main`), unlike `--diff`/`--staged` which scope by changed file but still surface pre-existing findings in those files. Combine with `--diff origin/main --baseline origin/main` for a PR gate that fails only on issues the change actually introduced.
