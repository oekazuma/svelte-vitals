---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

Add `a11y/deprecated-element` and `a11y/deprecated-attr`, the first two rules on the vendored HTML spec data. `deprecated-element` reports the elements in the HTML standard's obsolete-features list (`<center>`, `<font>`, `<strike>`, …), leaving `<marquee>`/`<blink>` to the Svelte compiler; `deprecated-attr` reports an attribute the spec data marks deprecated on that element (`iframe[frameborder]`, `td[width]`, `hr[size]`), consulting the element's own attribute table only, so SVG sprites' `xlink:href` are never reported. Both are `info`, skip the SVG namespace, and yield one finding per element.

`@svelte-vitals/core` now embeds a projection of `@markuplint/html-spec` (MIT) as generated data; the notice ships in the built output. There is no new runtime dependency.
