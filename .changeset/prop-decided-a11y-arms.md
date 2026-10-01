---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

An `{#if}` in a component that one prop decides now counts, for landmarks and ids, only the arm the use selects when it passes that prop literally or not at all, as it already did for headings (`a11y/id-duplication`, `a11y/duplicate-landmark`, `a11y/top-level-landmark`). Findings this moves can already be pre-suppressed in projects with recorded entries for those rules.
