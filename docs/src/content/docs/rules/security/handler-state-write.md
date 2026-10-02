---
title: security/handler-state-write · Handler writes imported state
description: A load function or action writes to imported module state, shared across all requests on the server.
---

**Severity:** critical · **Category:** security

## What it checks

Flags writes to an **imported binding** from inside a server-executed handler, meaning `load`, a form action, a `+server` HTTP handler, or a `hooks.server` handler. The writes it looks for are property assignment (`state.user = …`), increment and `delete`, and `.set(...)` / `.update(...)` calls. Universal `+page.ts`/`+layout.ts` load functions are included, since they run on the server during SSR.

Not flagged:

- A universal `+page.ts`/`+layout.ts` file that itself exports `ssr = false`, or one whose route never renders on the server. A route never renders on the server when the nearest `ssr` export, looking first at the page's own `+page` files and then up its layout chain (following `+page@`/`+layout@` resets), is `ssr = false`. `ssr = dev` (with `dev` from `$app/environment`) counts as `false`, its value in every production build; an `ssr` exported as anything else counts as turning SSR back on. Where a node's universal module (`+page.ts`/`+layout.ts`) and its server module both export it, the universal one wins, as in SvelteKit. A layout qualifies only when every page under it does, and the root layout only when it exports `ssr = false` itself. That load never runs on the server, so there is no shared-process instance to leak through. `+page.server.ts` still runs server-side regardless of `ssr`, so server-kind files are unaffected.
- Reads, other method calls (`logger.info(…)`), and writes to local variables.
- A write only the browser reaches: after an early return such as `if (!browser) return;`, inside `if (browser)`, or on the right of `browser && …` (`browser` from `$app/environment`, or a `typeof window` check). In the browser each visitor has their own copy of the module. A write on the server side of the guard (`if (!browser) user.set(…)`) is still reported.
- `.set()`/`.update()` on imports from installed packages.
- `.update()` whose argument is not an updater function (a function literal, or a name the module binds to a function): a store's `update` takes one, while a database client's takes a table or options (`prisma.post.update({ … })`, `db.update(table)`), wherever the client is imported from.
- `.set()`/`.update()` on a **persistence client** resolving to `src/lib/server`: the directory entrypoint (`import { db } from '$lib/server'`) or anything under `src/lib/server/**`, such as Drizzle's `db.update(...).set(...)`. Those calls are persistence, not shared module state.

The `src/lib/server` exemption applies to the **resolved** path, so it holds however the module is imported, via the `$lib/server/` alias or a relative path (`../../lib/server/db`). A specifier whose `..` segments escape the project root is conservatively never treated as repo-local state.

The exemption is not the directory alone. svelte-vitals reads the target module and keeps the call exempt only when the export is _not_ an in-memory container. An export initialized to `new Map`/`Set`/`WeakMap`/`WeakSet`, or to an object or array literal, is a hand-rolled store, one shared instance overwritten per request, and is reported even under `src/lib/server`. An object literal whose properties are all functions, the module's own or function literals (`export const data = { get, set }`), holds no data and is not a store: `.set()` on it calls its own method. An object literal built with spreads (`{ ...models, ...handlers }`) is the exception: it is usually a facade over database clients and imported modules, so it counts as a store only when one of its own properties is itself a container (`{ ...defaults, hits: new Map() }`):

```ts src/lib/server/store.ts
export const db = new Map(); // reported when a handler calls db.set(...)
export const client = drizzle(url); // exempt — not a container literal
```

Anything the read cannot positively identify as a container stays exempt, so a wrapper around a real client, a re-export, or an unreadable module is never a false positive. Only the modules a handler actually writes to are read.

Outside `src/lib/server` the default runs the other way: a `.set()`/`.update()` from a handler on a repo-local import is reported unless the target module shows the binding is a client. A client is an export initialized with `new` of a class imported from an installed package, or of a class the module declares that extends nothing and keeps no `Map`/`Set`/`WeakMap`/`WeakSet` field (`export const kv = new KvService()`); or with a call into an installed package (`drizzle(url)`, `createClient(…)`), resolving the app's `kit.alias` entries first. A store library's factory, from `svelte/store` or a package whose name includes `store`, is not a client, so `export const user = writable(null)` stays reported.

## Why it matters

This is the pattern SvelteKit's state-management docs mark "NEVER DO THIS". The server is one long-lived process shared by every user, so module state written during one request is still there when the next request arrives. If that state holds per-request or per-user data, one user's data can leak to another. It works perfectly in single-user dev and corrupts silently in production.

Not every promoted write is a leak, though. A rate limiter or memoization cache keyed by something non-personal (an IP, a URL, a cache key) is the benign shape: it shares data across users by design, and that's fine. The finding fires on the write regardless, because the same call shape produces both. Verify which one a given write actually is.

## How to fix

Return the data instead of storing it:

```ts +page.ts
import { user } from '$lib/user';

export async function load({ fetch }) {
  const response = await fetch('/api/user');
  user.set(await response.json()); // ❌ shared across ALL requests on the server

  return { user: await response.json() }; // ✅ per-request page data
}
```

Per-user data belongs in cookies/`locals` plus a database; share loaded data with components via `page.data` or the context API. If the write is genuinely a rate limiter or memoization cache keyed by non-personal data, add `// svelte-vitals-disable-next-line security/handler-state-write` above it.

## Mode differences

None. This rule reads source, the same `.svelte` and `.ts` files, everywhere it runs. The CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

Silence a single occurrence with `<!-- svelte-vitals-disable-next-line security/handler-state-write -->` on the line above it, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'security/handler-state-write': 'off'
  }
};
```
