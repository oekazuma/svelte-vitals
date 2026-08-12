---
'svelte-vitals': patch
---

fix: shell completion now emits exactly one candidate per flag. Multi-line flag descriptions (e.g. `install --client`) no longer leak their continuation lines as bogus candidates, and `--no-color`/`--no-animation`/`--no-suppressions` now show their real descriptions instead of the bare stripped key.
