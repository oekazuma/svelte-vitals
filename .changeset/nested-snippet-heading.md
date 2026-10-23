---
'svelte-vitals': patch
---

`seo/heading-level-skip` places a heading of a snippet rendered only from inside another snippet at that inner `{@render}`, after the outer snippet's own headings before it. It used to sit at its definition's place within the outer snippet's render, so an `<h4>` in a snippet defined above the one that renders it after an `<h3>` was compared with the heading before the outer snippet instead, and reported as a skip.
