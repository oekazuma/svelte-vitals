---
'@svelte-vitals/core': patch
'svelte-vitals': patch
---

A page whose `load` redirects or throws `error()` on every request, apart from an `if (building)` (with `building` from `$app/environment`) that returns during a build, is now read as never rendering when nothing on its route's chain exports `prerender`: the build never renders it, and no request reaches that branch. Its route-level checks (head tags, headings, landmarks and the rest) no longer report it.
