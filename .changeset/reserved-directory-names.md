---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add `architecture/reserved-directory-names`, which holds a directory's immediate subdirectories to a
closed set of names you declare for that position. Like the other Architecture convention rules it is
off until configured: `scopes` maps a directory glob to the names its children may take, and
`unitScopes` maps a root glob to the names a unit's children may take — a unit being a directory whose
name begins with a capital and which holds a file named after it.

Where `architecture/directory-naming` checks a directory's casing, this checks its name, so it reports
the correctly-cased `helpers/` that no casing declaration objects to.
