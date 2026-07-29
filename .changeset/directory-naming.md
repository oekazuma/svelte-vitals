---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add `architecture/directory-naming`, which checks that a directory is named in the casing its
location declares. Like the other Architecture convention rules it is off until configured: set
`directories` to a map of directory glob to casing set (`camelCase`, `PascalCase`, `kebab-case`,
`snake_case`, or several joined by `|`). SvelteKit route syntax is decoded before the check, so
`[hallId=integer]` is judged as `hallId` and `(app)` as `app`.
