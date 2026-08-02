---
title: security/handler-state-write · Handler writes imported state
description: A load function or action writes to imported module state — shared across all requests on the server.
---

**Severity:** critical · **Category:** security

## What it checks

Flags writes to an **imported binding** from inside a server-executed handler — `load`, a form action, a `+server` HTTP handler, or a `hooks.server` handler: property assignment (`state.user = …`), increment/`delete`, and `.set(...)` / `.update(...)` calls. Universal `+page.ts`/`+layout.ts` load functions are included — they run on the server during SSR.

Not flagged:

- Reads, other method calls (`logger.info(…)`), and writes to local variables.
- `.set()`/`.update()` on imports from installed packages.
- `.set()`/`.update()` on a **persistence client** resolving to `src/lib/server` — the directory entrypoint (`import { db } from '$lib/server'`) or anything under `src/lib/server/**`, such as Drizzle's `db.update(...).set(...)`. Those calls are persistence, not shared module state.

The `src/lib/server` exemption applies to the **resolved** path, so it holds however the module is imported — via the `$lib/server/` alias or a relative path (`../../lib/server/db`). A specifier whose `..` segments escape the project root is conservatively never treated as repo-local state.

The exemption is not the directory alone. svelte-vitals reads the target module and keeps the call exempt only when the export is _not_ an in-memory container. An export initialized to `new Map`/`Set`/`WeakMap`/`WeakSet`, or to an object or array literal, is a hand-rolled store — one shared instance overwritten per request — and is reported even under `src/lib/server`:

```ts
// src/lib/server/store.ts
export const db = new Map(); // reported when a handler calls db.set(...)
export const client = drizzle(url); // exempt — not a container literal
```

Anything the read cannot positively identify as a container stays exempt, so a wrapper around a real client, a re-export, or an unreadable module is never a false positive. Only the modules a handler actually writes to are read.

## Why it matters

This is the pattern SvelteKit's state-management docs mark "NEVER DO THIS". The server is one long-lived process shared by every user: module state written during Alice's request is still there when Bob's request arrives — Bob can be served Alice's data. It works perfectly in single-user dev and corrupts silently in production.

## How to fix

Return the data instead of storing it:

```ts
// +page.ts
import { user } from '$lib/user';

export async function load({ fetch }) {
  const response = await fetch('/api/user');
  user.set(await response.json()); // ❌ shared across ALL requests on the server

  return { user: await response.json() }; // ✅ per-request page data
}
```

Per-user data belongs in cookies/`locals` plus a database; share loaded data with components via `page.data` or the context API.
