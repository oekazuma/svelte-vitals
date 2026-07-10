---
'@svelte-vitals/core': minor
'svelte-vitals': minor
---

Console output now groups findings by rule and caps what's shown by default (top 5 rules per severity, the Passed section collapsed to a count, `--by-route` capped to the worst 10 routes) — pass `--verbose` for the old uncapped listing. The Health score also gets a short pulse-line reveal animation on an interactive terminal (disable with `--no-animation`).
