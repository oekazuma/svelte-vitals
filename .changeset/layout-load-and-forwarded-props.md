---
'@svelte-vitals/core': patch
'svelte-vitals': patch
---

Pages under a layout whose `load` redirects or errors on every call (other than the root layout) are read as never rendering, and route-level checks skip them, as they already did for a page's own `load`. An imported constant list handed to a built-in constructor in its module (`new Set(LIST)`) still counts as read there, so `{#each}` over it is no longer reported for a missing key. A heading behind an `{#if}` on a prop that a component in between passes on unchanged (`<Media {view} />`) is decided by the literal the outer use passed, as when the prop is passed directly.
