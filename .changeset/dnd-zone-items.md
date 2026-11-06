---
'@svelte-vitals/core': patch
'svelte-vitals': patch
---

`a11y/disallowed-aria-props` no longer flags a name on a child element of a svelte-dnd-action zone (`use:dndzone` or `use:dragHandleZone`), since the zone gives each child `role="listitem"` at runtime. A zone whose options set `autoAriaDisabled: true` is judged as before.
