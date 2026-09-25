---
'svelte-vitals': patch
---

`a11y/top-level-landmark` no longer reports a landmark as nested inside `banner`/`contentinfo` when the `<header>`/`<footer>` around it sits inside sectioning content, whether in its own file (e.g. a `<section>`) or through the layout above rendering the file inside `<main>` or `<aside>`. Such a header or footer is not a landmark, so the inner landmark is reported against the landmark around it, if any: an `<aside>` in a page's `<section><header>` rendered inside the layout's `<main>` now reads "nested inside main", under a new finding key.
