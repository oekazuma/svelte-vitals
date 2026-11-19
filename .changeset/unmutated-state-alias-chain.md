---
'svelte-vitals': patch
---

`correctness/unmutated-state` now follows a chain of locals holding a `$state` however many of its links are declared after the code that reads them, as when a nested function reads a local its enclosing function declares below it. A chain running backwards more than once was cut short, so a mutation through it was missed and the state reported as never mutated.
