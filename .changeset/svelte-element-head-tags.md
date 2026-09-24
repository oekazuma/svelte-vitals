---
'svelte-vitals': patch
---

Head tags written as `<svelte:element this="script">` (or `this={"script"}`, and likewise `meta`/`link`) inside `<svelte:head>` are now read like the element they render, so a JSON-LD block emitted that way no longer makes `seo/json-ld` report the route as missing structured data.
