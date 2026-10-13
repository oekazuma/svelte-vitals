---
'@svelte-vitals/core': patch
'svelte-vitals': patch
---

A route that the `handle` in `src/hooks.server.ts` answers on every request before calling `resolve` (an `if` on `event.url.pathname` alone, `=== '/x'` or `.startsWith('/x')`, whose body returns or throws) is now read as never rendering, like a page whose `load` always redirects, so the route-level checks such as `seo/title-presence` no longer report it. Apps with `kit.paths.base` or a `src/hooks.ts` (whose `reroute` may serve the route at other paths) are left as before.
