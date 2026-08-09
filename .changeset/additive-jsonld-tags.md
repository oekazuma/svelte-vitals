---
'svelte-vitals': patch
'@svelte-vitals/core': patch
---

The CLI's static mode now analyzes every `application/ld+json` script on a route — multiple tags in one head, tags split across the layout chain, and tags contributed by imported components — instead of silently keeping only the last one, matching what the vite plugin already does with rendered HTML. Gate movement: JSON-LD documents that were previously dropped are now checked by the whole json-ld rule family, so projects with defects in those documents will see new findings (warnings can turn a `--fail-on warning` run red, and Health can drop). Documents that were already the sole survivor are analyzed exactly as before.

One movement in the head-tag presence rules: when multiple tags of the same kind match on a route — JSON-LD always can now, and rendered HTML can carry duplicate metas — the rule reports the strongest one (a satisfying tag beats an empty one, own beats inherited) instead of an arbitrary first/last survivor. A route with a valid document alongside an empty script now passes where it could (order-dependently) report 'Empty' before, so a previously-reported Empty finding can disappear; routes whose every script is empty still report Empty. Findings from layout- or component-contributed documents are attributed to the contributing file.
