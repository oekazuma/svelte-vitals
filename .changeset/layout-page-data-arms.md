---
'svelte-vitals': patch
---

`a11y/duplicate-landmark` and `a11y/top-level-landmark` read a layout's and a page's arms on the same field of the `load` data together: a layout that wraps the page in `<main>` only under `{#if data.user}`, and a page whose own `<main>` is under `{#if !data.user}`, no longer count two `<main>`s or a nested one. The `data` prop, `page.data` from `$app/state`, `$page.data` from `$app/stores` and a `$derived` holding one of them are read as one value across the route's files.
