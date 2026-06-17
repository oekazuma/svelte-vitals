---
'svelte-vitals': minor
'@svelte-vitals/core': minor
---

Detection layers 2–4: resolve head metadata set via components, not just literal `<svelte:head>`.

- Built-in adapters for `svelte-meta-tags` (`MetaTags`) and `svelte-seo`.
- Transitive resolution of custom `src/` components (depth-limited, cycle-guarded).
- `--meta-components` flag to declare opaque meta components, plus `--treat-dynamic-as` and `--route` flags.
- Components recognized as meta sources suppress false "missing" verdicts; unknown components do not.
