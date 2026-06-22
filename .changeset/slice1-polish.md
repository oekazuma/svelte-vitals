---
'svelte-vitals': patch
---

Slice 1 polish (#13): capture the imported name from string-literal import
specifiers (`import { 'a-b' as c }`) instead of falling back to the local alias,
and warn instead of silently defaulting when `--treat-dynamic-as` gets an
unknown value. Adds direct unit coverage for `attrValueOf` and for component
detection inside `{#if}` branches.
