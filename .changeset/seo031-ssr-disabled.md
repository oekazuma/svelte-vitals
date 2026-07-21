---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add SEO031 (warning): flag SvelteKit route files that disable server-side rendering with `export const ssr = false` — per the official SEO guidance, server-rendered content indexes more reliably, and SPA mode adds a round trip before first paint. The root-layout (app-wide) case gets a dedicated message; deliberate SPAs can turn the rule off or suppress inline.
