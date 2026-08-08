---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Update the registry-visible package descriptions and keywords, which still described svelte-vitals as an SEO-only checker. `svelte-vitals`'s description now matches its own `--help` text — a deterministic SvelteKit code-health scanner across SEO, performance, correctness, security, and architecture — and adds `performance`, `security`, `code-quality`, `static-analysis` keywords. `@svelte-vitals/vite`'s description now also mentions the live dev dashboard alongside the build-time prerendered-HTML analysis. No behavior change.
