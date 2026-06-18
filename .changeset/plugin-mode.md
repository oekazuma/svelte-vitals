---
'@svelte-vitals/core': minor
'@svelte-vitals/vite': minor
---

Plugin mode: `@svelte-vitals/vite` analyzes prerendered HTML during `vite build` and runs the full SEO rule set (library-agnostic), gating the build via `failOn`. Console/JSON reports with a per-route score; only prerendered routes are covered. The core console reporter gained an optional `mode` label for the header line.
