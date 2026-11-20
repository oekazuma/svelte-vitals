---
'svelte-vitals': patch
---

A `+page` `load` that starts with `while (building) return …;` and then redirects or errors is now read like one that starts with `if (building) return …;`: on a request the loop never runs, so the `load` always sends the visitor away. When nothing on the route's chain exports `prerender`, that route's route-level findings are left out, as they already were for the `if` form.
