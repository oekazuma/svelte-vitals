---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

Add `a11y/positive-tabindex`: flags elements with a literal `tabindex` whose value parses to an integer above 0. A positive tabindex puts the element ahead of every naturally-ordered element on the page, so a single `tabindex="1"` reorders keyboard navigation globally — only `0` (join the natural order) and `-1` (programmatically focusable) are safe values. Expression-valued `tabindex` is unknowable and passes.
