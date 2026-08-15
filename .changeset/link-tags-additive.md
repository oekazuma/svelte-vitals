---
'svelte-vitals': patch
---

Source mode no longer collapses `<link>` tags that share a `rel`. The composed `<svelte:head>` used to keep only the last `<link>` per `rel` across the layout chain, so a page with two `rel="preload"` (font + stylesheet), both Google Fonts `rel="preconnect"` origins, or several `rel="alternate" hreflang` entries was analyzed with only one of them — a false "un-preconnected origin" finding for a correctly configured site, and skipped preload/hreflang checks. Every `<link>` except `rel="canonical"` (still page-overrides-layout) is now kept, like JSON-LD. Projects with baselines or recorded suppressions may see new Performance/SEO findings on links that were previously invisible.
