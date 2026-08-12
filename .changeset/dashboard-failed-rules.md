---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': patch
---

`@svelte-vitals/core` now exports `formatFailedRuleWarning`, the "rule … failed and was skipped" message formatter shared by the CLI, build mode, and (now) the dev dashboard.

`svelte-vitals`'s `analyzeProject` now also returns `failedRuleIds`, the ids of rules that crashed during the run (already folded into its returned `config` via `withFailedRulesOff`, exposed separately so a caller with its own base config can apply the same correction without adopting `analyzeProject`'s config).

The dev dashboard now scores a crashed rule as not-run (matching the CLI and build mode) instead of silently inflating Health, without disturbing plugin-option `weights`/`overrides`; plugin warnings strip terminal escape sequences.
