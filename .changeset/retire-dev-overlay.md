---
'@svelte-vitals/vite': minor
'svelte-vitals': minor
---

Live dashboard: `svelteVitals()`'s `ui` option now defaults to `true` — the dashboard at `/__svelte-vitals/` is on during `vite dev` unless you pass `ui: false`. `svelteVitalsHandle` no longer prints findings to the terminal (the dashboard supersedes that output); it still feeds the dashboard's per-route accuracy when enabled.

CLI: the `install` wizard's `vite-dev-overlay` target is renamed `vite-hooks`, with copy describing its real effect (dashboard accuracy) instead of terminal warnings.
