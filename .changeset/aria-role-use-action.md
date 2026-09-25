---
'@svelte-vitals/core': patch
---

`a11y/disallowed-aria-props` and the per-role arm of `a11y/deprecated-aria` make no judgment on an element that carries a `use:` action and no literal `role`, as they already did for a spread: the action can set the role at runtime (svelte-dnd-action's drag handles become `role="button"`), so `<span use:dragHandle aria-label="…">` is no longer reported.
