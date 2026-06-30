---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/mcp': minor
---

Add an **Architecture** category — the third "Svelte Doctor" code-health category,
reusing the component-body scan (CLI/static mode). Deterministic, high-precision
size metrics that flag bloated "god components":

- **ARCH001** Component size: flags a `.svelte` file over 400 lines (info).
- **ARCH002** Prop count: flags a component destructuring more than 10 props from
  `$props()` (info).

`ComponentFacts` gains `loc` and `propCount`; the console reporter shows an
Architecture score line.
