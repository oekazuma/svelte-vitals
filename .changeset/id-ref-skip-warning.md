---
'svelte-vitals': patch
---

Make the `a11y/no-missing-id-ref` skip notice self-explanatory: it now says the rule only checks routes it can fully resolve and that a skip is not a failure, drops the per-cause counts when a single route is skipped, points at `--reporter json` for the per-route detail, and links to the rule's docs page.
