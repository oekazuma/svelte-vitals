---
'@svelte-vitals/core': patch
---

Fix the inline `svelte-vitals-disable-next-line` directive silently ignoring `a11y/*` rule ids. The directive's rule-id pattern only allowed letters in the category segment, so `<!-- svelte-vitals-disable-next-line a11y/invalid-role -->` was not recognised at all and the finding stayed. Category segments may now contain digits.
