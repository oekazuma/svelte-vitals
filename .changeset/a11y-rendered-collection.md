---
'@svelte-vitals/vite': minor
---

Build mode now collects landmarks, ids, and id references from the actual **prerendered HTML** for the cross-component Accessibility rules, mirroring how it already re-verifies SEO/Performance against the shipped output rather than trusting source.
