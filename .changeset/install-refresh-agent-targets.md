---
'svelte-vitals': minor
---

`install --refresh` regenerates whichever generated agent instruction files (`claude-skill`, `cursor-rules`) already exist on disk with the current rule set, without needing to remember which `--client` ids were originally installed. It never creates a file that isn't already there, ignores `--scope`/`--yes`/`--force`, and cannot be combined with `--client`.
