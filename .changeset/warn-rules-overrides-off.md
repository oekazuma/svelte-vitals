---
'svelte-vitals': patch
---

Naming a rule in `--rules` that a config `overrides` entry scopes `'off'` (directly by rule id, or via its category key) now prints a startup warning naming the rule and the overrides entry's `files`/`route` scope, instead of silently reporting a compliant tree. The semantics — whether `--rules` should force-enable through a scoped `'off'` — are deliberately unchanged; only the silence is fixed (#385).
