---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

A page whose own `load` throws SvelteKit's `error()` on every path, like one that always redirects, now counts as never rendering: the route shows its `+error` page instead, so the route-level checks skip it (the component rules still read its files). A route under maintenance (`error(503)`) was reported as missing its title, description, social tags and `<h1>`.
