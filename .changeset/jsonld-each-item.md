---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`seo/json-ld` now counts `{@html item}` inside an `{#each}` over a list the source names for JSON-LD (`{#each metadata.jsonLdScripts as script}{@html script}{/each}`) as a JSON-LD block, in `<svelte:head>` and in the body. The block counts as present even when the list may be empty on a route.
