---
'svelte-vitals': patch
---

Source analysis now treats a `<svelte:head>` `<meta>` whose `name` or `property` is an expression, such as `<meta {property} {content} />` inside `{#each Object.entries(ogTags) as [property, content]}`, as possibly any meta of that attribute. Such a head was reported as missing every Open Graph and Twitter tag it renders. Now a dynamic `property` counts as a `dynamic` `og:title`, `og:description`, `og:image`, `og:url` and `twitter:card`, and a dynamic `name` counts as a `dynamic` `description` and `twitter:card`, unless the route already sets that tag literally. A tag with any literal key (a component's bound `property="og:title"`) keeps that key.

A tag the list-building code only sometimes emits, such as an `og:image` set only when a page has an image, is no longer reported as missing on routes that render such a head.
