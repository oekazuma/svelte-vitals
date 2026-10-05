---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`seo/single-h1` counts a heading below `{#if}` blocks without an `{:else}` as part of the one arm its conditions leave in a block with an `{:else}` (`{#if signedIn}<h1>…{/if}` against an `<h1>` in the `{:else}` of `{#if signedIn}`), so the two are no longer reported as multiple `<h1>`s.
