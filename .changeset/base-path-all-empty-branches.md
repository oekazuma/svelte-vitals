---
'@svelte-vitals/core': patch
---

`correctness/base-path-navigation` no longer treats a computed `kit.paths.base` as a base when every branch it can take is the literal `''` (`base: process.env.NODE_ENV === 'production' ? '' : ''`). A computed base with any non-empty or non-literal branch still opens the rule.
