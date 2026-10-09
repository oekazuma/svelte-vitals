---
'svelte-vitals': patch
---

The route tests that decide a layout's or page's `{#if}` (`seo/single-h1`, `seo/heading-level-skip`, `a11y/id-duplication`, `a11y/duplicate-landmark`) also read a `.some` over a list of path strings, testing each with `startsWith`, `endsWith` or `includes` (`PUBLIC.some((r) => page.url.pathname.startsWith(r))`), and a `const` list of strings wherever an array literal was read.
