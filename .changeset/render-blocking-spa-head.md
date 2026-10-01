---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`performance/render-blocking-script` no longer reports a `<svelte:head>` script on a route that is never server-rendered (`ssr = false` along its layout chain), where the client adds it after parsing; a script in `src/app.html` is still reported.
