---
'svelte-vitals': patch
---

A component's `{#if prop.length > 0}` (and the other `.length` comparisons) is now decided when the prop holds an array literal, passed (`keys={['a']}`) or as its default (`let { keys = [] } = $props()` on a use that omits it), as it already was for a string. `a11y/id-duplication`, `a11y/duplicate-landmark`, `seo/single-h1` and `seo/heading-level-skip` no longer count the arm such a test rules out.
