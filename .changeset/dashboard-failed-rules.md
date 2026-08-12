---
'@svelte-vitals/core': minor
'@svelte-vitals/vite': patch
---

`@svelte-vitals/core` now exports `formatFailedRuleWarning`, the "rule … failed and was skipped" message formatter shared by the CLI, build mode, and (now) the dev dashboard.

The dev dashboard now scores a crashed rule as not-run (matching the CLI and build mode) instead of silently inflating Health; plugin warnings strip terminal escape sequences.
