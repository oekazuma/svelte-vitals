---
'svelte-vitals': patch
---

A `load` that starts with `if (!FLAGS.beta) redirect(…)`, where `FLAGS` is an imported object literal with `beta: false`, is now read as sending every request away even when a quoted key (`'new-ui': true`) follows `beta` in that object. The quoted key used to drop the `false` members written before it, so the routes below that `load` were checked as if they rendered. Their route-level findings are now left out, as they already were for an object without quoted keys.
