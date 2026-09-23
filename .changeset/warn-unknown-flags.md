---
'svelte-vitals': patch
---

Warn on stderr when an unknown long flag is passed (with a did-you-mean hint), instead of ignoring it silently. A typo such as `--rule` for `--rules` no longer lets a run report success as if the flag had applied. The flag is still ignored and the exit code is unchanged.
