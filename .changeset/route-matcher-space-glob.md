---
'svelte-vitals': patch
---

Route globs (`--route`, config `routes`) containing a literal space now match that space literally. Previously an internal placeholder collision silently turned each space into `.*`, over-matching (e.g. `blog/my post` matched `/blog/my-post`).
