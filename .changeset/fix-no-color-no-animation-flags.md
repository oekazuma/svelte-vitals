---
'svelte-vitals': patch
---

Fix `--no-color` and `--no-animation`, which silently had no effect regardless of whether they were passed — the CLI's argument parser (`mri`) auto-negates `--no-X` flags into `{X: false}`, not a `'no-X'` key, so the code reading `argv['no-color']`/`argv['no-animation']` was always reading `undefined`.
