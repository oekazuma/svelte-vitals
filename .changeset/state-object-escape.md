---
'@svelte-vitals/core': patch
---

`correctness/unmutated-state` no longer reports a `$state` placed in an object or array, such as `setContext('form', { lang })` or `const payload = { ids }` handed to a callback, when its initial value or type argument shows it holds an object (`$state({})`, `$state([])`, `$state(new Date())`, `$state(saved ?? {})`, `$state<string[]>(…)`, or a built-in object type such as `$state<Record<string, string>>(…)`): the reference goes wherever that value goes, and the receiving code may mutate it. A spread (`[...list, x]`) copies the state and still counts, and so does a state that may hold a primitive.
