---
'@svelte-vitals/core': patch
---

`a11y/id-duplication` findings now recommend the fix that matches the duplicate. When every occurrence is the same source line, the id is hardcoded in a component rendered more than once on the route, and the finding recommends generating it per instance with `$props.id()` (Svelte 5.20+) rather than renaming it. When the occurrences are at different locations, it recommends renaming one, or joining separate `{#if}` blocks that never render together into one `{#if}…{:else}`. Detection is unchanged.
