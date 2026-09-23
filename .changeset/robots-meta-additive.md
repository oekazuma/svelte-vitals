---
'svelte-vitals': patch
---

Source analysis keeps every `<meta name="robots">` a route renders (from `app.html`, each layout and the page) instead of letting a later one replace an earlier one. Crawlers apply the most restrictive directive, so a `noindex` in `app.html` or a layout is now reported by `seo/indexability` even when the page sets `index`.
