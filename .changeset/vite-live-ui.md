---
'@svelte-vitals/vite': minor
---

Add a live UI dashboard: `svelteVitals({ ui: true })` serves a svelte-vitals report at
`/__svelte-vitals/` during `vite dev`, fed by `svelteVitalsHandle`, that updates live as you
navigate. It reuses the same renderer as the CLI's `--reporter html`. Dev-only and
rendered-based (SEO `<head>` rules for visited routes); the dev overlay's behavior is
unchanged when the UI is not enabled.
