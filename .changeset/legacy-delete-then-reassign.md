---
'@svelte-vitals/core': patch
---

`correctness/prop-mutation` accepts the legacy idiom of deleting a key from an `export let` prop and then reassigning the prop in the same function (`delete params.x; params = { ...params }`), including when the `delete` sits in a callback inside that function. It already accepted the same idiom for mutating method calls.
