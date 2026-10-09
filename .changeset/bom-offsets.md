---
'@svelte-vitals/core': patch
'svelte-vitals': patch
---

A `.svelte` file saved with a byte order mark is read at the right offsets. Svelte drops the mark before parsing, so every expression read from such a file was off by one character, and a layout's `{#if}` on `page.route.id` through a `$derived` was not decided by the route.
