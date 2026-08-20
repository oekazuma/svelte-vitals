---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

New rule `a11y/permitted-contents`: every literal child element must be permitted content of its literal parent, per the HTML content models (membership only — order and count are unjudgeable statically). Severity is split by consequence: broken structure (a non-`<li>` child of `<ul>`, a heading inside a `<button>`, a `<li>` outside any list) is `warning`; category mismatches (`<button><div>`) are `info`. `<option>` rich content follows the compiler (allowed), and interactive nesting stays `a11y/interactive-nesting`'s verdict, so one defect is never two findings. Measured on eleven real apps before building: 351 adjudicated-true findings, 0 false positives.

`ElementFact` (internal surface) gains `parent`, `attrs[*].value`, `hasSpread`, and `unknownContent`.
