---
'svelte-vitals': patch
---

Fix `--route` selecting nothing when the glob is written with a leading slash.

Routes were matched with their leading slash stripped but the glob was not, so
`--route "/blog/**"` — the form the CLI guide documents, and the form every route the tool
prints is written in — matched no route at all. The run reported zero findings and exited 0,
so a CI job scoped to a subtree looked green while checking nothing. The glob is now
normalized the same way the route is; both `/blog/**` and `blog/**` select the same routes.
