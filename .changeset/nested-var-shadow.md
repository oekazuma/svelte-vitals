---
'svelte-vitals': patch
---

A `var` anywhere in a `load`, or in a helper it calls, now counts as a binding of the whole function, as JavaScript hoists it, and not only a `var` at the top of the body. So `{ var redirect = log; } redirect(307, '/')` is no longer read as sending every request away, an `if (building)` or `while (building)` after `{ var building = true; }` is no longer read as the `$app/environment` flag, and a leading `if (!FLAG) error(404)` guard is no longer read as one on the imported `FLAG` when the `load` declares its own `var FLAG` in a nested block. The routes such a `load` covers are checked as rendering again, so their route-level findings come back.
