---
'@svelte-vitals/core': patch
---

`correctness/server-browser-global` and `correctness/instance-browser-global` no longer treat `browser || …` as a browser guard. The right-hand side of `||` runs exactly when `browser` is false, so `if (browser || location.hash)` reads `location` on the server and is now reported. `browser && …` and `!browser || …` are still guards.
