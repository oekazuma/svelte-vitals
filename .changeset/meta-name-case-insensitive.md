---
'svelte-vitals': patch
---

Source analysis now matches `<meta name>` case-insensitively, as HTML does. A route with `<meta name="Description" …>` was reported as missing its description, and `<meta name="Robots" content="noindex">` was not seen by `seo/indexability`.
