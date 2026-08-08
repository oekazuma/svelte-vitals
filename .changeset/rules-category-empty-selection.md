---
'svelte-vitals': patch
---

Exit 2 when `--rules` and `--category` are both passed and `--category` excludes every rule named in `--rules`. Previously `analyzeProject`'s category filter ran after rule selection, so a `--rules` id whose category wasn't in `--category` was dropped silently — the run exited 0 with zero rules examined and nothing on stderr (issue #384). The check mirrors the existing unknown-rule-id error: fatal, naming the excluded rule id(s) and the `--category` list. `--ignore` is unaffected — ignoring a rule that `--category` already excludes is harmless, not a conflict.
