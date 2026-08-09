---
'@svelte-vitals/core': patch
'svelte-vitals': patch
---

Files that fail to parse are no longer silently invisible: collectors mark them (`parseFailed` on the fact) and the CLI prints a stderr warning listing the skipped files. No finding, score, or exit-code movement — stderr diagnostics only; reporter stdout (json/sarif) is unchanged and still machine-parseable.
