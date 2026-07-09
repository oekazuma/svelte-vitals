---
'@svelte-vitals/vite': minor
---

`svelteVitals({ ui: true })` now prints the live dashboard's URL right after Vite's own `Local:`/`Network:` lines every time `vite dev` starts, so the dashboard is discoverable without knowing the `/__svelte-vitals/` path in advance.
