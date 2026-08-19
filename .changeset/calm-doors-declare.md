---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

Add two declaration-driven rules, `a11y/disallowed-element` and `a11y/required-element`. Both are inert until a project declares tag names in their `elements` option (`{ options: { elements: ['iframe'] } }`); an `overrides` entry adds to the list for the routes or files it matches. `disallowed-element` reports every occurrence of a declared tag in component source. `required-element` judges the composed route — layout chain, page, resolved components, and `app.html`'s `<body>` — so a layout's `<main>` counts; presence passes in any world, and a missing element is reported only where the route is closed for elements (build mode always; static mode where every component resolved and there is no `{@html}` or `<svelte:element>`).

The `elements` declaration is a bare tag name — letters, digits, hyphens — and selector syntax is rejected when the config loads, so a later attribute-qualified form can be added without changing what today's configs mean. `string-list` rule options can now declare a `pattern` for this.
