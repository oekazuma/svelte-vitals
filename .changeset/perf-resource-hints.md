---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

Add two static resource-hint Performance checks: PERF003 flags a `<link rel="preload">`
with no `as` attribute (the browser ignores or double-fetches it), and PERF004 flags a
`<link rel="preload" as="font">` with no `crossorigin` (the font preload is wasted and the
file downloads twice). Both surface in the CLI, the static report, and the vite plugin /
dev UI. Static mode evaluates hints in `<svelte:head>`; resource hints in `app.html` are
covered in plugin/rendered mode.
