---
'@svelte-vitals/core': patch
---

`security/handler-state-write` no longer reports `ns.update(…)` or `ns.set(…)` on a namespace import (`import * as gist from '$lib/db/gist.js'`) as a store write. That call runs the module's exported `update`/`set` function; a store on the module is still reported when it's written as `ns.store.set(…)`.
