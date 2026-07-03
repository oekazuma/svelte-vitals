---
'@svelte-vitals/core': minor
'svelte-vitals': minor
---

Rich console output: the default `console` reporter now colorizes the Health/category
scores, severity sections, and pass/fail markers, and shows an "Analyzing…" spinner
during the scan. All of it auto-disables under `NO_COLOR`, a non-TTY stdout, a
non-`console` reporter, or `--no-color` (and honors `FORCE_COLOR`). Color is an
injected `Palette` (identity by default), so `@svelte-vitals/core` stays
dependency-free and other reporters are unchanged.
