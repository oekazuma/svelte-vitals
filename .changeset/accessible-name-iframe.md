---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

`a11y/accessible-name` now also checks `<iframe>`: a frame with none of `title`, `aria-label`, or `aria-labelledby` is announced by screen readers as an unnamed frame. A blank `title=""` computes no name and is reported; hidden or presentational frames (`aria-hidden="true"`, `hidden`, `role="presentation"`/`"none"`) and SVG-namespace iframes are skipped, and expression-valued attributes resolve to silence as everywhere in this rule.

Because this is a new arm on an existing rule, its findings share the rule's `id::route::location` suppression keys — a committed suppressions entry already recorded for `a11y/accessible-name` at the same route and file keeps matching, so iframe findings there can be pre-suppressed in projects with existing entries.

Also, the shared element-facts channel now records a blank literal attribute value (`title=""`) as an empty string instead of folding it into "expression": `a11y/no-autofocus` consequently reports `autofocus=""` (browsers treat it as set), which it previously skipped as unknowable.
