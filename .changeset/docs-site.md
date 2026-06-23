---
'@svelte-vitals/core': patch
'svelte-vitals': patch
---

Add a documentation site (Starlight, bilingual en/ja) at
https://oekazuma.github.io/svelte-vitals/ with rule references and guides, and point every
finding's `docsUrl` (and the SARIF `informationUri`) at it — previously these linked to an
unpublished domain. Rule doc slugs are lowercased (e.g. `/rules/seo001`).
