---
'@svelte-vitals/vite': minor
---

Collect `<img>` elements in rendered (vite) mode so the image rules — PERF001,
PERF002, PERF005, PERF006, and SEO025 — now run during build analysis and in the
dev hook, not only in static (CLI) mode (#61). Previously the vite plugin
silently skipped every image/alt check.
