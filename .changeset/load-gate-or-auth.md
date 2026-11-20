---
'svelte-vitals': patch
---

A server `load` that starts with `if (!locals.user || …) redirect(…)` is now read as sending visitors without a session away, as `if (!locals.user) redirect(…)` already was: every such visitor takes the branch, whatever the other side of the `||` reads. `seo/description-presence` and `seo/canonical-url` findings on the routes below it are reported as `info`.
