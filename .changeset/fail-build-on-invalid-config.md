---
'@svelte-vitals/vite': minor
---

An invalid `svelte-vitals.config.*` (unknown rule id, invalid `weights`, malformed `overrides[]`) now fails `vite build` instead of being caught and skipped with a `svelte-vitals: skipped — analysis failed` warning — matching the CLI's exit-2 stance on the same validation errors. In `vite dev`, the same invalid config no longer crashes the dev server at startup: the dashboard now warns and falls back to plugin options/defaults.
