---
'svelte-vitals': patch
'@svelte-vitals/core': patch
'@svelte-vitals/vite': patch
---

Scoping notices now say what to do next: an unmatched `--route` or `overrides` glob names the glob form it expects and where the routes/files are listed, a `--rules` id that `--route` cannot examine says why and how to check it, an inline directive naming an unknown rule points at `svelte-vitals explain --list`, and the Vite plugin's warnings share the CLI's `svelte-vitals:` prefix.
