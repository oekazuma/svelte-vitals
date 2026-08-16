---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

Recognise `<aside>` as a `complementary` landmark, in both analysis modes.

Only `main`, `header` and `footer` mapped to landmarks, so the scenario `a11y/top-level-landmark`
exists for — a layout rendering its children inside `<main>` while the page contributes a
complementary region — was undetectable in the markup people write. The docs even taught
`<aside role="complementary">`, which Svelte's own compiler flags as a redundant role.

Following the HTML accessibility mapping: an `<aside>` scoped to `<body>` or `<main>` is a
`complementary` landmark; inside sectioning content (`<article>`, `<aside>`, `<nav>`, `<section>`)
it is one only when it carries an `aria-label` or `aria-labelledby`.

**This widens detection** — a route with a layout `<main>` and a page `<aside>` newly reports
`a11y/top-level-landmark`. Projects with recorded suppressions for that rule may need a new entry;
`--update-suppressions` records it.

Also fixed while here: the per-file top-level approximation that decides whether a `<header>` or
`<footer>` is a landmark was being applied to every non-`main` tag, so a landmark nested below the
top level of its own file was dropped. It now applies to `<header>` and `<footer>` only, which is
what it was always meant to mean.
