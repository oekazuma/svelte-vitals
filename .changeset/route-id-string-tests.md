---
'svelte-vitals': patch
---

A layout or page `{#if}` that tests the route id with `startsWith`, `endsWith` or `includes` against a string literal (`page.route.id?.startsWith('/admin') ?? false`, also through a `$derived`) is now decided per route, as the same tests on `page.url.pathname` were. Headings, ids and landmarks in an arm that cannot hold on a route no longer count there, so `a11y/top-level-landmark`, `a11y/duplicate-landmark`, `a11y/id-duplication`, `seo/single-h1` and `seo/heading-level-skip` stop reporting a root layout's `<main>` on the routes it hands to another shell.
