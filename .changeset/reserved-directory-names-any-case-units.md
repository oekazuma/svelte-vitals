---
'@svelte-vitals/core': minor
---

Add `anyCaseUnitScopes` to `architecture/reserved-directory-names`: a counterpart to `unitScopes` that
governs units whose name does not begin A–Z.

`unitScopes` identifies a unit with `isUnitDir`, which requires the directory name to begin A–Z as well
as holding a same-stemmed child file — so a lowercase, `.ts`- or `.svelte.ts`-entry unit's children (measured
at 129 of 299 units, 43%, on a real tree) were never governed by any declaration. `anyCaseUnitScopes` takes
the same option shape against `isAnyCaseUnitDir`, the same test without the letter requirement. Declaring
the identical glob in both maps is not a collision: `unitScopes` governs at capitalised units,
`anyCaseUnitScopes` governs alone at the lowercase ones `unitScopes` never reaches.

Default behavior is unchanged — `anyCaseUnitScopes` defaults to `{}`, so a project that does not declare it
sees no new findings.
