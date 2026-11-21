---
'svelte-vitals': patch
---

`a11y/permitted-contents` now names the exclusion that rejected a child whose content category the parent otherwise admits. A `<div>` holding a `<header>` inside `<footer>` is reported with "it contains `<header>`, which `<footer>`'s content model excludes", and a `<header>` directly inside `<footer>` with "`<footer>`'s content model excludes `<header>`", where both used to say only "`<footer>`'s content model is flow content". Which children are reported, and at which severity, is unchanged.
