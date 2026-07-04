---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/mcp': minor
---

Add an inline `svelte-vitals-disable-next-line` comment to suppress a specific component-scoped rule's finding on the following line (`// ...` in `<script>`, `<!-- ... -->` in markup) — a targeted escape hatch for intentional patterns a rule can't infer statically, such as a mount-only `$effect` used to avoid a hydration mismatch. Covers CORRECT001–004, SEC001–002, ARCH001–002, and PERF009–010. Fixes #92.
