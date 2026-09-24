---
'@svelte-vitals/core': patch
'svelte-vitals': patch
---

`seo/single-h1` now counts a component's `<h1>` as part of the `{#if}`/`{:else if}`/`{:else}` or `{#await}` arm the component is placed in, instead of as if it always rendered. A page that shows its own `<h1>` in one arm and a `<Header />` with an `<h1>` in another, or the same component once per arm, is no longer reported as having multiple `<h1>`s. A page also renders inside the arm of its layout's `<slot />`/`{@render children()}`, so a layout that shows its own `<h1>` only in place of the page no longer adds it to the page's. When a folded `<h1>` was where a remaining "Multiple `<h1>`" finding pointed, the finding now points at the next one, so a suppression recorded for the old location no longer matches it.
