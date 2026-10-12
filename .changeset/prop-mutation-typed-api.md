---
'@svelte-vitals/core': patch
'svelte-vitals': patch
---

`correctness/prop-mutation` no longer flags a method called directly on a prop whose `$props()` type annotation is not a collection, such as `queryClient.clear()` on a `QueryClient` or `roster.add(…)` on an interface of the app's own: the call is that type's own API, not an array, Set or Map mutation. A built-in collection type, a same-file alias of one, a named type with type arguments, and a call whose result is assigned back to the prop are still flagged.
