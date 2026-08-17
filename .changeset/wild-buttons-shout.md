---
'@svelte-vitals/core': minor
'@svelte-vitals/vite': minor
'svelte-vitals': minor
---

Apply `svelte-vitals-disable-next-line` to every finding the report anchors to a file and a line, route-level ones included — a duplicate landmark, a second `<h1>`, an image missing dimensions. Previously the directive was read only by the file-scoped rules, so a comment above a route-level finding did nothing and said nothing.

A suppressed finding becomes a pass for that rule and route rather than disappearing, so the route stays in the category average. A directive inside a component silences the finding on every route composing that component; per-route suppression remains the suppressions file's job.

A directive naming a rule id that no rule declares is now reported as a warning instead of silently suppressing nothing — on full runs, gated like the stale-suppressions report, since a `--route` run parses files it never analyses.

Report selections that matched nothing, so a run cannot look clean because it checked nothing: a `--route` glob matching no route, an `overrides` entry whose route glob matches no route (full runs only), and a rule named by `--rules` whose facts a `--route` run does not collect.
