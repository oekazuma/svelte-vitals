---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`{@html NAME}` in `<svelte:head>` now counts as a JSON-LD block when the script binding `NAME` is built from a string that contains `application/ld+json` (``let ld = $derived(`${LT}script type="application/ld+json">…`)``), not only when the `{@html}` expression itself names JSON-LD. Routes that emit their structured data this way are no longer reported by `seo/json-ld`.
