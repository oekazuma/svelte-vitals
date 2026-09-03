---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Re-evaluate `svelte-vitals.config.{js,ts}` when it changes instead of serving Node's ESM module cache. In `vite dev` the dashboard re-analysis now runs with the edited config, and the dashboard's own scoring config (weights, overrides) follows the edit too; an edit that fails validation is warned about and the previous config is kept. Modules the config file imports are still cached until the dev server process restarts.
