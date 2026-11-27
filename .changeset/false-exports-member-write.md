---
'svelte-vitals': patch
---

A `load` that starts with `if (!FLAGS.beta) redirect(…)`, where `FLAGS` is an imported object literal with `beta: false`, is no longer read as sending every request away when the module exporting `FLAGS` also writes to that member, as in `if (env.BETA) FLAGS.beta = true;`. Every form of write counts: an assignment, `++`, `delete`, a destructuring or `for…of` target. A write through a computed key (`FLAGS[name] = true`) counts for every member. The routes such a `load` covers are checked as rendering again, so their route-level findings come back. A write from another module is still not seen.
