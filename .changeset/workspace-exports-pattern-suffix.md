---
'svelte-vitals': patch
'@svelte-vitals/core': patch
'@svelte-vitals/vite': patch
---

A workspace package whose `exports` pattern target adds a suffix after `*` (`"./*": "./src/lib/*.js"`) now resolves: `@repo/core/client/ui` reads `src/lib/client/ui.js`, or the `ui.ts` source behind it. Such subpaths used to stay unresolved, so a route that renders its `<h1>`, `<title>` or meta tags through a component imported that way was reported as missing them. Those components' tags and headings now count toward every head and heading rule, which can surface findings from them.
