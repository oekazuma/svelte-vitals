---
'@svelte-vitals/core': patch
'svelte-vitals': patch
---

Headings in the arms of one `{#if}`/`{:else if}`/`{:else}` or `{#await}` block are no longer counted as if they all render. `seo/single-h1` no longer reports "Multiple `<h1>`" for a page that shows a different `<h1>` per state, and `seo/heading-level-skip` no longer reports a skip between headings from sibling arms (an `<h1>` in one arm followed by an `<h3>` in the `{:else}`). Separate `{#if}` blocks still count together.

When a folded arm was where a "Multiple `<h1>`" finding pointed, the finding now points at the next `<h1>` that still counts, so a suppression recorded for the old location no longer matches it.
