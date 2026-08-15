---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Treat `<link>` `rel` and `as` keywords as case-insensitive, as the HTML spec does. `<link rel="Canonical">` is now recognised by seo/canonical-url (and overrides a layout canonical instead of being added alongside it), and `rel="Preload"` is now seen by the preload rules, in both source and rendered-HTML analysis.
