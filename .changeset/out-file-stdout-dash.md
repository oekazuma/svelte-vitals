---
'svelte-vitals': patch
---

Let `--out-file -` (space-separated) and `--out-file=-` stream to stdout again, matching the documented contract (`--help`, the reporters guide, and `svelte-vitals docs show output`). The flag-shaped/empty-value guard added in the previous release rejected the literal `-` along with every other dash-prefixed value; `-` is now the one allowed exception, exempted only for `--out-file`. Regular file paths (e.g. `--out-file report.html`) were never affected and remain valid; dash-prefixed values for every other flag — and any dash-prefixed `--out-file` value other than exactly `-` — still exit 2 as before.
