---
title: performance/load-waterfall · Load waterfall
description: Dependent sequential awaits in a universal load cost a network round trip from the browser per hop.
---

**Severity:** warning · **Category:** performance

## What it checks

Flags await chains in a **universal** load (`+page.ts` / `+layout.ts`) where a later await uses the result of an earlier one — directly, through destructured bindings, or through intermediate constants. Each dependent hop is a full network round trip from the browser on client-side navigation.

The scan is deliberately conservative:

- It follows the load body's straight-line statements (directly `try`-wrapped ones included) and does not enter `if` branches, loops, or nested functions.
- `await parent()` is never flagged itself, but data derived from it counts as a dependency.
- Reading a response body (`await res.json()` and friends) is not a hop — it costs no extra round trip — though data parsed from it still carries the dependency forward.
- Dependent chains in **server** loads are exempt: they cannot be parallelized and already run server-side.
- Files disabling client-side rendering (`export const csr = false`) are exempt — without a client runtime the universal load only runs during SSR.

## Why it matters

SvelteKit's performance guidance names request waterfalls as a primary latency source. A universal load re-runs in the browser on client-side navigation, so a chain of N dependent requests costs N sequential round trips on every visit.

Moving the chain to a server load keeps the logic but runs the hops server-to-server, collapsing the client cost to one round trip.

## How to fix

Move the dependent chain into a server load:

```ts +page.server.ts
export async function load({ fetch }) {
  const user = await fetch(`/api/user`).then((r) => r.json());
  const posts = await fetch(`/api/posts/${user.id}`).then((r) => r.json());
  return { user, posts };
}
```

If part of the data is independent, split it out and parallelize (see `performance/sequential-awaits`).

## Limitations

Only the literal dependent-chain shape is detected; chains hidden behind branches, loops, helper functions, or module-level caches are not. A finding can be silenced per line with `// svelte-vitals-disable-next-line performance/load-waterfall`.

## Disabling

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/load-waterfall': 'off'
  }
};
```
