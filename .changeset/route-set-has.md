---
'@svelte-vitals/core': patch
'svelte-vitals': patch
---

A layout or page `{#if}` that tests the route with `.has` on a `new Set([…])` of route ids the file never changes (`FULL.has(page.route.id ?? '')`, also through a `$derived`) is now decided per route, as the same test with `.includes` on an array was. Headings, ids and landmarks in an arm that cannot hold on a route no longer count there, so `a11y/top-level-landmark`, `a11y/duplicate-landmark`, `a11y/id-duplication`, `seo/single-h1` and `seo/heading-level-skip` stop reporting a layout's `<main>` or heading on routes the Set leaves it out of.
