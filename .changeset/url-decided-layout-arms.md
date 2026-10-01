---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

A layout that renders its children in several arms of one `{#if}` now leaves out, per route, the arms whose test reads `page.url.pathname` (`$page` too, directly or through `$derived`) with `startsWith`, `endsWith`, `includes` or `===` against a string literal and cannot hold on that route's path. Landmarks, ids and headings of an arm the route never renders are no longer counted with its page (`a11y/duplicate-landmark`, `a11y/top-level-landmark`, `a11y/id-duplication`, `seo/single-h1`, `seo/heading-level-skip`). Findings this moves can already be pre-suppressed in projects with recorded entries for those rules.
