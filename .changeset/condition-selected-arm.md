---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

A heading whose own conditions leave only one arm of an earlier `{#if}…{:else}` block now renders with that arm, so `seo/heading-level-skip` judges it against the heading that arm renders (after `{#if !rule}…{:else}<CardTitle />{/if}`, a heading in `{#if open && rule}` follows that title). Findings this moves can already be pre-suppressed in projects with recorded entries for that rule.
