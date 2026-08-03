---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

Add `architecture/doc-link-target`, which reports a documentation link inside a component comment whose
target no longer exists.

Such a link has nothing to resolve it — no type refers to it, no module imports it, no test renders it — so
a rename leaves it silently broken and only human review notices. A reorganisation that renames many units
can break every one of them at once.

**Off until configured.** Declare `urlRoots` with the URL prefixes that stand for your project's root; a
link under one of them has that prefix stripped and the remainder looked up among the files under `src/`. A
URL under no declared prefix is ignored, which is what keeps external links and documentation slugs out of
the results — as is a remainder that lands outside `src/` (a root-level `CONTRIBUTING.md`, a `static/`
asset), since the file inventory has no opinion there. A directory link written with its ordinary trailing
slash resolves the same as one without.
