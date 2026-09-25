---
'@svelte-vitals/core': patch
---

`correctness/server-browser-global` and `correctness/instance-browser-global` accept a `typeof` comparison against any type string as a browser guard, so `typeof matchMedia === 'function' && matchMedia(…)` is no longer reported. Previously only a comparison with `'undefined'` counted.
