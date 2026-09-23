---
'svelte-vitals': patch
---

Source analysis now reads `<svelte:head>` tags nested in `{#if}`, `{#each}`, `{#await}` and `{#key}` blocks. They were dropped, so a page that sets its `<title>` or description in an `{#if}`/`{:else}` was reported as missing them (`seo/title-presence` critical), or inherited its layout's description and was flagged by `seo/duplicate-description`. A tag inside `{#if}`, `{#each}` or `{#await}` counts as dynamic, because which branch renders is only known at runtime; a tag inside `{#key}` keeps its literal value.
