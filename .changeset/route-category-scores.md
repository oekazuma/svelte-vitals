---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

Each entry in the JSON report's `routes` array now carries a `categories` map of category name to score.

A category's score is an average over its keys, so a category that looks wrong gives no clue which routes
produced it. The report listed each route's findings but not what each route scored per category, and since a
key's score became a ratio against the severity-weighted inventory of the checks it was measured against, that
number is no longer something a reader can reconstruct by hand.

Only the categories that produced a result on a route appear, so an absent category means "not measured here"
rather than "perfect here". A route's `categories` values are **not guaranteed** to average to its `score`:
`score` is one ratio over everything the route was measured against, while each category score uses that
category's own inventory. They agree whenever every category on the route scores the same ratio — including
every route with no findings — and can differ by several points otherwise.
