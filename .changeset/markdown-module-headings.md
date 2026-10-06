---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`seo/single-h1` and `seo/heading-level-skip` follow a markdown module rendered as a component (an mdsvex `.md` or `.svx` import) and read its ATX headings. A component held in a `let` with `$derived` or assigned by a legacy `$: Content = …` is followed like one in a `const`; when it holds one of several modules that each always render a heading, `seo/heading-level-skip` places one of an undetermined level there and does not judge the heading after it.
