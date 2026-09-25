---
'svelte-vitals': patch
'@svelte-vitals/core': patch
---

Source analysis now follows a component a function loads with `import()` into a `let` and renders from it (`onMount(async () => { Meta = (await import('$lib/Meta.svelte')).default })`, a module local from `await import(…)` or `Promise.all([import(…)])`, or a destructured export). It renders only in the browser, so its `<title>`, meta tags and JSON-LD count as dynamic on routes with `ssr = false` and not at all on server-rendered routes, whose HTML lacks them. On a route with `ssr = false`, an `<h1>` in it likewise keeps `seo/single-h1` from reporting the route as missing one. A component from a package, including a workspace package, is still not followed.
