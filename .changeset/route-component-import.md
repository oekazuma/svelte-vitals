---
'@svelte-vitals/core': patch
---

Add `architecture/route-component-import`, which reports a component importing a SvelteKit route entry
(`+page.svelte`, `+layout.svelte`, `+error.svelte`, and their `@` breakout forms).

This is the first Architecture rule that is **on by default**, so a project that changes nothing may see
new findings at `info`. Kit renders a route entry with the data it supplies; imported elsewhere the
component renders without it. Stories, tests and specs are exempt by default, and `exemptImporters`
extends that list for a project whose satellite files are named another way.
