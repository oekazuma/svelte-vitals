---
'@svelte-vitals/core': patch
---

`correctness/server-browser-global` and `correctness/instance-browser-global` accept a `typeof` check that a browser global has a given type as a guard, so `typeof matchMedia === 'function' && matchMedia(…)` is no longer reported. Previously only a comparison with `'undefined'` counted; that one still guards with either `===` or `!==`, while a check against another type guards only with `===`/`==` (`typeof matchMedia !== 'function'` is true on the server).
