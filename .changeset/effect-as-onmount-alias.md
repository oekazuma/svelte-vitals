---
'@svelte-vitals/core': patch
---

`correctness/effect-as-onmount` follows a plain local alias of an imported binding or a `new …()` local (`const p = presenter`, `const p = presenter as Presenter`), so an effect that reads class `$state` fields through the alias is no longer reported as reading nothing reactive.
