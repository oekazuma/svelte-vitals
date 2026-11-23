---
'svelte-vitals': patch
---

`correctness/unmutated-state` no longer reports a `$state` mutated through a local that is reassigned to another part of the same state (`let h = hours[0]; h = hours[1]; h.n = 1`, or `node = node.next` while walking a list), in the script or in a template handler. A local reassigned to anything else is still not followed.
