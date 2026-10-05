---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`seo/title-presence` counts a title set by an exported function of a repo-local module that a page or layout script calls (`$effect(() => syncTitle())`, where `syncTitle` assigns `document.title`), on a route nothing else titles. Like a `document.title` in the component's own script, it counts only on routes that are never server-rendered.
