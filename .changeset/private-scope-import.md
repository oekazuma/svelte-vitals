---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

New rule `architecture/private-scope-import`: a unit inside a directory you have declared private
must not be imported from outside that directory's owner. It is **inert until configured** — set
`scopes` to a list of globs naming your private directories, and nothing changes for projects that
do not.

Each glob matches a private directory and its parent becomes the boundary, so the same directory
name can mean different things in different places: with `scopes: ['src/routes/**/components']`, a
route's `components/` is private to that route while `src/lib/components` stays shared. When private
directories nest, the innermost one wins.

Imports through a custom `svelte.config.js` alias, and imports made from `.svelte.ts` / `+page.ts`
modules, are not checked yet.
