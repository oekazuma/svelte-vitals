---
'@svelte-vitals/vite': patch
---

A `vite build` that prerenders no pages (an SPA served from a fallback page, or an app with nothing opted into prerendering) no longer finishes silently with nothing checked. The plugin now prints one warning that route analysis was skipped, and still runs the project-wide source scan, reports it, and fails the build when its findings reach `failOn`. Such a build can therefore start failing on source findings it never checked before. `seo/html-lang` is not reported in that case, since there is no rendered `<html>` to read.
