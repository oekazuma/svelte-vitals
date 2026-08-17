---
'@svelte-vitals/core': minor
'@svelte-vitals/vite': minor
'svelte-vitals': minor
---

Apply `svelte-vitals-disable-next-line` to every finding the report anchors to a file and a line, route-level ones included — a duplicate landmark, a second `<h1>`, an image missing dimensions. Previously the directive was read only by the file-scoped rules, so a comment above a route-level finding did nothing and said nothing.

A suppressed finding becomes a pass for that rule and route rather than disappearing, so the route stays in the category average. A directive inside a component silences the finding on every route composing that component; per-route suppression remains the suppressions file's job.

A directive naming a rule id that no rule declares is now reported as a warning instead of silently suppressing nothing. A directive that suppressed nothing stays silent by default — it is legitimate after a fix, under `--route`, or with the rule off — and the new `--report-unused-directives` flag opts into reporting those, judged across every route at once.
