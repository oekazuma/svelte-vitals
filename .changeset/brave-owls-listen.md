---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

Add `a11y/disallowed-aria-props` and `a11y/deprecated-aria`, judged against the ARIA 1.3 role tables in the vendored HTML spec data. `disallowed-aria-props` (warning) reports an `aria-*` attribute the element's role prohibits — most often `aria-label` on a bare `<div>`/`<span>`, which the Svelte compiler does not warn about — or does not own; for elements whose implicit role depends on context (`<a>`, `<img>`, `<input>`, …) it judges only what holds under every role the element could have. `deprecated-aria` (info) reports `role="directory"`, `aria-dropeffect`/`aria-grabbed`, and an attribute deprecated on its role (`aria-haspopup` on `checkbox`, `aria-disabled` on `generic`). Both overlap the compiler's `a11y_role_supports_aria_props` on explicit roles and never disagree with it: the ten (role, attribute) pairs where the ARIA 1.3 tables and the compiler's data differ are exempted, and `<address>`/`<hgroup>` follow the ARIA-in-HTML specification rather than the dataset.

`a11y/deprecated-element` now reports `<marquee>` and `<blink>` as well — they were excluded because the compiler warns on them, which left the score blind to two of the 29 obsolete elements while it counted `<font>`. The two never disagree; the overlap is the same deliberate one every ARIA rule already has.
