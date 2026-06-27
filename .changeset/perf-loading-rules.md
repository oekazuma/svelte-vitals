---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add PERF005–PERF008, four static Performance checks (#60):

- **PERF005** LCP image eager loading: flags the first `<img>` (likely LCP) when
  it is `loading="lazy"` (static/CLI mode).
- **PERF006** Responsive image: flags an `<img>` without `srcset` (info; static/CLI mode).
- **PERF007** Render-blocking script: flags a `<head>` `<script src>` without
  `defer`/`async`/`type="module"`, in app.html (rendered) or `<svelte:head>` (static).
- **PERF008** Preconnect third-party origin: flags a well-known third-party
  origin (Google Fonts) referenced without a `preconnect`/`dns-prefetch` (info).

The head model gains `kind: 'script'`, `href`, and `blocking`; `<img>` capture
gains `lazy` and `hasSrcset`.
