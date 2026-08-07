---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Fix `architecture/reserved-name-placement`'s dead-declaration diagnostic naming a correct
declaration while staying silent about a broken one. Its unit-map reason judged a declaration by
whether its glob had happened to govern a directory, not by whether the glob could reach one: a
convention permitting a position no directory occupies yet was reported as dead even though it was
correct, while a unit-map glob that could never match anything (a bare glob such as
`capitalisedUnitPlacements: { parts: 'src/lib' }`, matched against the unit itself rather than an
ancestor of it) reported nothing at all. The excluded-directory reason had the same defect for the
same reason: it fired on any declaration whose glob matched at least one excluded directory, even
one that also reached a live, correctly-placed unit.

All three reasons now ask what a declaration's glob can reach, against the same live-directory and
live-unit sets: `matched no directory`, `matched only excluded directories`, and the unit reason —
now `reaches no unit` — are unaffected when a glob's only matches are directories that don't yet
exist for that name, but fire when a glob structurally cannot reach a unit of the required case or
a directory `exclude` leaves live. The rule's findings do not change; only which declarations the
aggregated diagnostic names.
