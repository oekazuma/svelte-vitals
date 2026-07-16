---
title: CORRECT007 · Lifecycle call outside component initialisation
description: onMount, getContext and friends called outside component initialisation throw lifecycle_outside_component at runtime.
---

**Severity:** critical · **Category:** correctness

## What it checks

Flags calls to Svelte's lifecycle and context functions (`onMount`, `onDestroy`, `beforeUpdate`, `afterUpdate`, `createEventDispatcher`, `getContext`, `setContext`, `hasContext`, `getAllContexts` — value-imported from `svelte`, aliases and namespace imports included) that are guaranteed to run outside component initialisation:

- at **module scope** in a `.svelte.ts`/`.svelte.js` runes module or a `.svelte` `<script module>` block,
- in the **constructor of a class instantiated at module scope** (same file),
- in a SvelteKit **`load` function, form action, endpoint or hooks handler, or the `init` hook, or at the top level of such a file** — the classic trap is `getContext` inside `load`.

Not flagged: calls inside ordinary functions (a component may legally call them during its own initialisation), `createContext()` (module-scope creation is the official pattern of the new context API), non-context svelte exports (`mount`, `tick`, …), same-named functions imported from other modules, factory functions/IIFEs/cross-file classes, and `svelte/legacy`'s `createBubbler`. A function defined _inside_ a load/handler/`init` body is treated as running there too and inherits the flag — if you deliberately return such a closure for a component to call during its own initialisation, add an inline suppression (`svelte-vitals-disable-next-line CORRECT007`).

## Why it matters

These functions require an active component context. Called without one they throw Svelte's `lifecycle_outside_component` error at runtime — the compiler compiles all of these patterns without a warning, so the failure only surfaces when the code path runs, typically as a production crash (in a `load` function: a 500 on every visit to that route).

## How to fix

```ts
// +page.ts
import { getContext } from 'svelte';

export async function load({ fetch }) {
  const user = getContext('user'); // ❌ lifecycle_outside_component — load is not component init

  return { user: await (await fetch('/api/user')).json() }; // ✅ return data instead
}
```

Move the call into component initialisation:

```svelte
<!-- +page.svelte -->
<script>
  import { setContext } from 'svelte';

  let { data } = $props();
  setContext('user', () => data.user); // ✅ component init — legal
</script>
```

For shared modules, expose a setup function that components call during init instead of running lifecycle calls at module scope.
