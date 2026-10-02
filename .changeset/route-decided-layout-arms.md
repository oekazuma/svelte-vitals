---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Any `{#if}` in a layout or page, not only one around `{@render children()}`, is now decided per route by its request test, and the test may also be `page.route.id` against a literal or in an array literal (`[...].includes(page.route.id)`), a regex literal's `.test()` of the path, or the path's `===` against a template literal (each `${…}` taken as the route parameter in its place). Headings, landmarks and ids of an arm a route cannot render are no longer counted there (`a11y/id-duplication`, `a11y/duplicate-landmark`, `a11y/top-level-landmark`, `seo/single-h1`, `seo/heading-level-skip`); a section heading that renders only on another route can now leave a route without an `<h1>`. Findings this moves can already be pre-suppressed in projects with recorded entries for those rules.
