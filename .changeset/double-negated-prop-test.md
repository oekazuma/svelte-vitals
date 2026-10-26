---
'svelte-vitals': patch
---

In source analysis, a component's `{#if}` whose test is a double negation of a prop test (`$derived(!!(title || heading))`) is decided by the use as the test it wraps, as `{#if title || heading}` already was. `seo/single-h1`, `seo/heading-level-skip`, `a11y/duplicate-landmark` and `a11y/id-duplication` used to count both arms there, so a section title rendered by `<Section title="…">` was missed and the `<h3>` passed into it was reported as a skip from the page's `<h1>`.
