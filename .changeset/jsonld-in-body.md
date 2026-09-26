---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`seo/json-ld` now counts JSON-LD in `<body>` as well as `<head>`, since search engines read it anywhere in the document. Source analysis counts a JSON-LD `<script>` or `{@html}` the markup renders outside `<svelte:head>` as a dynamic block, and the build pass reads `<script type="application/ld+json">` in the rendered `<body>`. A `{@html NAME}` binding is also recognised when its opening tag is assembled from fragments (`"<scr" + 'ipt type="application/ld+json">'`) or built from another such binding. A block under a condition counts as present on every route that renders its component, so a route that renders the component without the condition holding is no longer reported as missing JSON-LD.
