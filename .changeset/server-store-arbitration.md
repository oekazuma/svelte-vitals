---
'@svelte-vitals/core': minor
---

`security/handler-state-write` now reports a hand-rolled in-memory store under `$lib/server`.

The rule exempts `.set()`/`.update()` on imports resolving under the `$lib` server root, because
that is where database and KV clients live and `db.set(…)` there is persistence, not shared state.
The check was purely path-based, so a plain `new Map()` in the same directory — one shared
instance, overwritten by every request — was exempt too:

```ts
// src/lib/server/store.ts
export const db = new Map();

// src/routes/+page.server.ts
import { db } from '$lib/server/store';
export async function load({ locals }) {
  db.set('user', locals.user); // previously not reported
}
```

svelte-vitals now reads the target module and keeps the call exempt only when the export is not an
in-memory container. An export initialized to `new Map`/`Set`/`WeakMap`/`WeakSet`, or to an object
or array literal, is reported; anything else — a client constructed from a package, a re-export, an
unreadable module — stays exempt. A wrapper the read cannot inspect therefore stays silent rather
than becoming a false positive. Only the modules a handler actually writes to are read, so a project whose handlers never
touch `$lib/server` does no extra I/O.

Property writes (`store.user = …`) were already reported wherever they appear and are unchanged.
