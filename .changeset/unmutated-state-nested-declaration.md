---
'@svelte-vitals/core': patch
---

`correctness/unmutated-state` now sees writes to a `$state` declared inside a function, such as a factory whose `refresh()` method reassigns it. Every such state used to be reported as never mutated, however it was written.
