---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

A layout that renders `{@render children()}` (or `<slot />`) in several arms of one `{#if}` now places the page in each of those arms instead of above the block. Its other arms are then exclusive with the page: `seo/single-h1`, `a11y/id-duplication` and the landmark rules no longer count a heading, id or landmark that only the arm without the page renders. `seo/heading-level-skip` also judges the page against each arm's own headings, so it can report a skip that only one arm has. A `seo/single-h1` finding on such a route may now name a different extra `<h1>`, so a suppression recorded for the old location no longer matches it.
