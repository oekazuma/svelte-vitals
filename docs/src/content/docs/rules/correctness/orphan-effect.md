---
title: correctness/orphan-effect · Orphan $effect
description: An $effect created outside component initialisation throws effect_orphan at runtime.
---

**Severity:** critical · **Category:** correctness

## What it checks

Flags `$effect` / `$effect.pre` calls that are guaranteed to run outside component initialisation, so they throw Svelte's `effect_orphan` error at runtime:

- A **top-level effect** in a `.svelte.ts` / `.svelte.js` runes module or in a `.svelte` `<script module>` block — it runs when the module is imported, outside any component's initialisation.
- A **module-scope `new`** of a class declared in the same file whose constructor creates a bare `$effect` (one not wrapped in `$effect.root`) — the shared-state-manager pattern. The finding points at the `new` site.

Not flagged: effects inside functions (factory functions and IIFEs included), inside an `$effect.root(...)` callback, in class field initializers or static blocks, or in anonymous class expressions (`const Store = class { … }`); and classes only instantiated inside components, or imported from another file.

Detection never crosses a function boundary, so it never mistakes a nested function for module evaluation — at the cost of missing cross-file and factory variants. It can still report a guarded effect whose guard is never true at runtime, since a guard cannot be evaluated statically.

A conditionally-guarded effect — behind a top-level `if`, or behind a constructor-argument check (`constructor(persist) { if (persist) $effect(...) }`) — is still flagged even if the guard is never true at runtime, because the guard can't be evaluated statically. Use an inline suppression (`svelte-vitals-disable-next-line correctness/orphan-effect`) if the guard is intentional.

## Why it matters

The compiler accepts all of these without warning; the failure is runtime-only. In development it can go unnoticed, since the module may only be imported on certain routes; in production it is a crash — typically a 500 on every page that imports it.

Reactive effects can only be created while a component is initialising, or inside an explicit `$effect.root` scope.

## How to fix

```ts
// store.svelte.ts
class QuizStateManager {
  bookmarks = $state<string[]>([]);
  constructor() {
    // ❌ effect_orphan at runtime — no component context at module scope
    $effect(() => {
      saveToStorage(this.bookmarks);
    });
  }
}
export const quizState = new QuizStateManager();
```

Either create a standalone reactive scope with `$effect.root` — fine when the effect should live for the whole app; own the returned cleanup function if it shouldn't:

```ts
constructor() {
  $effect.root(() => {
    $effect(() => {
      saveToStorage(this.bookmarks);
    });
  });
}
```

Or set the effect up during component initialisation instead:

```ts
class QuizStateManager {
  bookmarks = $state<string[]>([]);
  startPersisting() {
    $effect(() => {
      saveToStorage(this.bookmarks);
    });
  }
}
export const quizState = new QuizStateManager();
```

```svelte
<!-- +layout.svelte -->
<script>
  import { quizState } from '$lib/store.svelte.js';
  quizState.startPersisting();
</script>
```
