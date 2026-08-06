---
'@svelte-vitals/core': minor
'svelte-vitals': minor
---

Add architecture/reserved-name-placement: a reserved directory name may appear only in the places declared for it.

Its sibling, `architecture/reserved-directory-names`, says which names a position allows; this rule says which
positions a name allows, for names permitted in more than one kind of place at once — under a unit, under a
grouping directory, under a route directory. It is off until you configure it: all three placement maps
default to `{}`.
