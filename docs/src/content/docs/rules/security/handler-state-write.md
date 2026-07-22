---
title: security/handler-state-write · Handler writes imported state
description: A load function or action writes to imported module state — shared across all requests on the server.
---

**Severity:** critical · **Category:** security

## What it checks

Flags writes to an **imported binding** from inside a server-executed handler — `load`, a form action, a `+server` HTTP handler, or a `hooks.server` handler: property assignment (`state.user = …`), increment/`delete`, and `.set(...)` / `.update(...)` calls. Universal `+page.ts`/`+layout.ts` load functions are included — they run on the server during SSR.

Reads, other method calls (`logger.info(…)`), and writes to local variables are not flagged. Nor are `.set()`/`.update()` calls on imports from installed packages or anything resolving to `src/lib/server` — the directory-entrypoint import (`import { db } from '$lib/server'`) as well as anything under `src/lib/server/**` (database/KV clients — e.g. Drizzle's `db.update(...).set(...)`) — that exemption is applied to the resolved path, so it holds however the module is imported, whether via the `$lib/server/` alias or a relative path (`../../lib/server/db`), and a specifier whose `..` segments escape the project root is conservatively never treated as repo-local state; those are persistence, not shared module state.

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
