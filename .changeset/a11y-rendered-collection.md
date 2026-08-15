---
'@svelte-vitals/vite': minor
---

Build mode and the dev dashboard now collect landmarks, ids, and id references from the actual **rendered HTML** for the cross-component Accessibility rules, mirroring how they already re-verify SEO/Performance against the shipped output rather than trusting source.
