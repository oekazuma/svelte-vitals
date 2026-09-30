---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`seo/title-presence` counts a title the script sets with `document.title = …` on routes that are never server-rendered (`ssr = false`), as it already does for a component mounted with `import()`. A script that also reads `document.title` only rewrites a title set elsewhere and is not counted, and a server-rendered route's HTML still has no such title.
