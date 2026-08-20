---
title: correctness/orphan-lifecycle · Lifecycle call outside component initialisation
description: onMount, getContext and friends called outside component initialisation throw lifecycle_outside_component at runtime.
---

**Severity:** critical · **Category:** correctness

## What it checks

Flags calls to Svelte's lifecycle and context functions (`onMount`, `onDestroy`, `beforeUpdate`, `afterUpdate`, `createEventDispatcher`, `getContext`, `setContext`, `hasContext`, `getAllContexts` — value-imported from `svelte`, aliases and namespace imports included) that are guaranteed to run outside component initialisation:

- at **module scope** in a `.svelte.ts`/`.svelte.js` runes module or a `.svelte` `<script module>` block,
- in the **constructor of a class instantiated at module scope** (same file),
- in a SvelteKit **`load` function, form action, endpoint or hooks handler, or the `init` hook, or at the top level of such a file** — the classic trap is `getContext` inside `load`.

Not flagged:

- Calls inside ordinary functions — a component may legally call them during its own initialisation.
- `createContext()`: module-scope creation is the official pattern of the new context API.
- Non-context svelte exports (`mount`, `tick`, …), same-named functions imported from other modules, factory functions/IIFEs/cross-file classes, and `svelte/legacy`'s `createBubbler`.

A function defined _inside_ a load/handler/`init` body is treated as running there and inherits the flag. If you deliberately return such a closure for a component to call during its own initialisation, add `svelte-vitals-disable-next-line correctness/orphan-lifecycle`.

## Why it matters

These functions require an active component context. Called without one, `getContext`/`setContext`/`hasContext`/`getAllContexts` throw Svelte's `lifecycle_outside_component` error at runtime in every environment — the compiler compiles all of these patterns without a warning, so the failure only surfaces when the code path runs (in a `load` function: a 500 on every visit to that route).

`onMount`/`beforeUpdate`/`afterUpdate`/`createEventDispatcher` throw the same error in the browser. But in a Kit module that only ever runs on the server (`+page.server.ts`, `+server.ts`, `hooks.server.ts`) they never reach the browser at all, so the call is a silent no-op instead — no crash, nothing happens. `onDestroy` is the odd one out even there: it has no component-context guard of its own, so calling it still crashes, just with a plain `TypeError` instead of `lifecycle_outside_component` (still a 500 on every request if it's in a `load`/handler). In a `+page.ts`/`+layout.ts` universal module or in component-scoped code, the same code also runs in the browser, where all nine throw `lifecycle_outside_component`.

## How to fix

```ts +page.ts
import { getContext } from 'svelte';

export async function load({ fetch }) {
  const user = getContext('user'); // ❌ lifecycle_outside_component — load is not component init

  return { user: await (await fetch('/api/user')).json() }; // ✅ return data instead
}
```

Move the call into component initialisation:

```svelte +page.svelte
<script>
  import { setContext } from 'svelte';

  let { data } = $props();
  setContext('user', () => data.user); // ✅ component init — legal
</script>
```

For shared modules, expose a setup function that components call during init instead of running lifecycle calls at module scope.

## Mode differences

None. This rule reads source — the same `.svelte` and `.ts` files — on every surface: the CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

Silence a single occurrence with `<!-- svelte-vitals-disable-next-line correctness/orphan-lifecycle -->` on the line above it, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'correctness/orphan-lifecycle': 'off'
  }
};
```
