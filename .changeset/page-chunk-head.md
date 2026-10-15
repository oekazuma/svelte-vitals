---
'@svelte-vitals/core': patch
'svelte-vitals': patch
---

When the `handle` in `src/hooks.server.ts` replaces a whole comment in `src/app.html`'s `<head>` through `transformPageChunk` (`html.replace('<!--seo-head-->', …)`), every route is now read as carrying the title, description, canonical, `og:*`, `twitter:card` and robots tags such a block may hold, with values the source does not fix. `seo/canonical-url`, `seo/description-presence`, `seo/og-*` and `seo/twitter-card` no longer report them missing; JSON-LD is not assumed.
