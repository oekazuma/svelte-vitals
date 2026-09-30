---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`seo/canonical-url` and `seo/description-presence` report as `info` instead of `warning` on a route whose server `load` (its own, or a layout's above it) sends a request without a session away first, e.g. `if (!locals.user) redirect(302, '/login')` or `error(401)`: a crawler never gets past that redirect. The finding's recommendation says why. Gates in `hooks.server.ts` or in the browser are not read, and a severity set for either rule in `rules` still applies. Source analysis only; the Vite plugin's rendered pass reads prerendered pages, which have no session gate.
