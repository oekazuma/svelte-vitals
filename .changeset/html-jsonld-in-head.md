---
'svelte-vitals': patch
---

Source analysis now counts an `{@html}` inside `<svelte:head>` as a `dynamic` JSON-LD block when its expression names JSON-LD (`jsonld`, `json-ld` or `ld+json`, e.g. `{@html serializeJsonLd(data.breadcrumbs)}`). A layout that emits its structured data this way was reported by `seo/json-ld` as missing JSON-LD on every route. Other `{@html}` injections, such as inline styles, are still not counted.
