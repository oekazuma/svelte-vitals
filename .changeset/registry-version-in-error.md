---
'svelte-vitals': patch
---

Unknown-rule-id errors from the config file now name the `svelte-vitals` and core versions whose registry produced the known-ids list. When two copies of svelte-vitals coexist in one tree (e.g. the Vite plugin's and a directly installed CLI), the version tag turns a registry mismatch from stack-trace archaeology into a visible version skew.
