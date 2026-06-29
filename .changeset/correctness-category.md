---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/mcp': minor
---

Add a **Correctness** category — the first analysis of Svelte component bodies
(not just `<head>`), broadening svelte-vitals toward a deterministic, agent-native
code-health scanner. A new static (CLI) scan reads every `.svelte` under `src/`
into a component-facts channel and adds two rules:

- **CORRECT001** Keyed each block: flags an `{#each}` with no key (reordering an
  unkeyed list destroys/recreates DOM and loses element state).
- **CORRECT002** Effect used to derive state: flags an `$effect` whose body only
  assigns to `$state` — the "useEffect → $effect" anti-pattern; use `$derived`.

Correctness findings are scored per source file and surface under the new
`correctness` category in the Health report. (CLI/static mode only.)
