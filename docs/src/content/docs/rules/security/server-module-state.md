---
title: security/server-module-state · Server module-scope state
description: A module-scope variable in a Kit route or hooks file is reassigned from a function — shared across all requests on the server.
---

**Severity:** warning · **Category:** security

## What it checks

Flags reassignment (`=`, `+=`, `??=`, `++`, …) of a **module-scope `let`/`var`** from inside a function in a SvelteKit route or hooks file (`+page(.server).ts`, `+layout(.server).ts`, `+server.ts`, `hooks.server.ts`). Reassignment directly from a request handler gets a stronger message than one in a helper function.

Not flagged:

- Top-level initialisation and `const` bindings.
- Mutation-style caches (`const cache = new Map()` + `cache.set(…)`), a deliberate memoisation pattern — though putting request-derived data in one carries the same risk.
- Anything under `src/lib/server/**`, which is not scanned at all, since legitimate singletons live there.
- Assignments inside SvelteKit's `init` hook, which runs once at server startup.

## Why it matters

SvelteKit's docs: "Avoid shared state on the server." A module variable on the server is one instance shared by every user — if an action stores Alice's form data there, Bob's next request reads it. The value also silently resets whenever the process restarts.

## How to fix

```ts
// +page.server.ts
let user; // ❌ one variable for every user of this server

export const actions = {
  default: async ({ request, cookies, locals }) => {
    const data = await request.formData();
    user = { name: data.get('name') }; // ❌ NEVER DO THIS

    await db.saveUser(locals.session, data); // ✅ per-user persistence
  }
};
```

Authenticate with cookies/`locals` and persist per-user data to a database. For a deliberate process-wide cache, prefer a `const` container or add `// svelte-vitals-disable-next-line security/server-module-state` above the assignment.

## Disabling

Silence a single occurrence with `<!-- svelte-vitals-disable-next-line security/server-module-state -->` on the line above it, or turn the rule off:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'security/server-module-state': 'off'
  }
};
```
