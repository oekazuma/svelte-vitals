---
'svelte-vitals': patch
---

fix: an internal crash in the CLI's dispatch layer now exits 2 with a one-line `svelte-vitals:` diagnostic instead of exit 1 with a raw stack trace — exit 1 keeps meaning "a finding failed the gate".
