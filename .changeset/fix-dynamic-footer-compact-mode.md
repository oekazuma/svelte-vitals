---
'@svelte-vitals/core': patch
---

Console reporter: stop printing the "↯ = set dynamically (verified at runtime)." footnote in compact (default, non-`--verbose`) mode. The `↯` marker itself only ever appears in the verbose `Passed` listing — showing the footnote without it visible anywhere in the output was confusing.
