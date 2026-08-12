---
'svelte-vitals': patch
---

`ci install`'s scaffolded workflow now sets `persist-credentials: false` on checkout and uses the same `actions/checkout` release this repo pins (v7.0.1). Existing workflows: re-run `svelte-vitals ci install --force` to regenerate.
