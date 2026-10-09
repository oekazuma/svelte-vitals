---
'svelte-vitals': patch
---

A component that does not parse no longer stops the run with exit 2 when a route imports it: it is skipped and listed with the other files that could not be parsed, as it already was when no route reached it. A `+page.svelte` or `+layout.svelte` that does not parse still exits 2.
