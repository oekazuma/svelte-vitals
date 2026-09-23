---
'@svelte-vitals/core': patch
---

`a11y/accessible-name` and `a11y/label-has-control` no longer treat a namespaced or unknown tag such as `<enhanced:img alt="…">` as empty content. A link wrapping an `@sveltejs/enhanced-img` image was reported as having no accessible name, although the preprocessor renders it as an `<img>` with that `alt`.
