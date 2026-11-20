---
'svelte-vitals': patch
---

A `load` that starts with `if (!FLAGS.beta) redirect(…)`, where `FLAGS` is an imported object literal with `beta: false`, is now read as sending every request away even when a quoted key (`'new-ui': true`) follows `beta` in that object. The quoted key used to drop the `false` members written before it. When that `load` is in a `+page` file or in a `+layout` file other than the root one, the routes it covers are no longer checked as if they rendered: their route-level findings are left out, as they already were for an object without quoted keys.
