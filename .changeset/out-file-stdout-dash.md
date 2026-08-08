---
'svelte-vitals': patch
---

Let `--out-file -` (space-separated) and `--out-file=-` stream to stdout again, matching the documented contract (`--help`, the reporters guide, and `svelte-vitals docs show output`). The flag-shaped/empty-value guard added in the previous release rejected the literal `-` along with every other dash-prefixed value; `-` is now the one allowed exception, exempted only for `--out-file`. Dash-shaped values for every other flag, and any other `--out-file` value, still exit 2 as before.
