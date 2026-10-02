---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

A layout `{#if}` whose test is an imported binding (`{#if FLAG}`, `{#if !FLAG}`) that one of the app's own modules exports as the literal `false` now renders only the arm that value selects. When no place the layout renders its children is left, the page and the layouts below it contribute no landmarks, ids, headings or images on that route (`a11y/duplicate-landmark`, `a11y/top-level-landmark`, `a11y/id-duplication`, `seo/single-h1`, `seo/heading-level-skip`); its head still counts. Findings this moves can already be pre-suppressed in projects with recorded entries for those rules.
