---
title: security/shared-state-import · Shared runes-state import on the server
description: A Kit server/universal file imports a .svelte.ts module holding module-scope $state — one shared instance per server process.
---

**Severity:** warning · **Category:** security

## What it checks

Flags an import in a SvelteKit route/hooks file whose specifier resolves to a repo-local `.svelte.ts`/`.svelte.js` module with **module-scope `$state`** (a top-level `$state(...)` declaration, or a module-scope instance of a class with `$state` fields). Two flavours:

- the server code **mutates** the imported state (outside handlers — handler writes are reported by `security/handler-state-write` as critical), or
- the import is **read-only** — on the server the state is still one shared instance that keeps its boot-time value.

Direct imports only (`$lib/…` and relative specifiers); `import type` is excluded. Client-only usage of such modules — the idiomatic shared-store pattern — is fine and never flagged; only imports from server-executed files are.

Not flagged: a universal `+page.ts`/`+layout.ts` file that itself exports `ssr = false`. SvelteKit's state-management docs: "If you're not using SSR, then there's no risk of accidentally exposing one user's data to another." That file's `load` never runs on the server, so there's no shared server instance to leak through — the exemption is same-file only, so a `+page.server.ts` (always server-executed, regardless of `ssr`) still gets flagged.

An extensionless `….svelte` specifier canonicalises to `….svelte.ts` for resolution purposes, so importing the _component_ `X.svelte` while a `$state`-holding `X.svelte.ts` sibling exists can misattribute a finding to the component import — a rare naming coincidence.

## Why it matters

On the browser each user gets their own module instance; on the server there is exactly one, shared by every request. If it ever holds per-user data, users see each other's data; even if it doesn't, server reads see a stale boot-time value rather than what the current user's client sees.

## How to fix

Don't reach for shared module state in server-executed code — return data from `load` and pass it via `page.data` or the context API:

```ts +page.server.ts
import { quizState } from '$lib/quiz.svelte.js'; // ❌ one instance for all users on the server

export async function load({ locals }) {
  return { bookmarks: await db.bookmarksFor(locals.user) }; // ✅
}
```

If the module is genuinely client-only, restructure so server files don't import it — or, if the import is deliberate and safe, add `// svelte-vitals-disable-next-line security/shared-state-import` above it.

## Disabling

Silence a single occurrence with `<!-- svelte-vitals-disable-next-line security/shared-state-import -->` on the line above it, or turn the rule off:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'security/shared-state-import': 'off'
  }
};
```
