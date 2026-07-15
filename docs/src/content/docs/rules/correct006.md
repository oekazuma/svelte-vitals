---
title: CORRECT006 · Orphan $effect
description: An $effect created outside component initialisation throws effect_orphan at runtime.
---

**Severity:** critical · **Category:** correctness

## What it checks

Flags `$effect` / `$effect.pre` calls that are guaranteed to run outside component initialisation, so they throw Svelte's `effect_orphan` error at runtime:

- A **top-level effect** in a `.svelte.ts` / `.svelte.js` runes module or in a `.svelte` `<script module>` block — it runs when the module is imported, outside any component's initialisation.
- A **module-scope `new`** of a class declared in the same file whose constructor creates a bare `$effect` (one not wrapped in `$effect.root`) — the shared-state-manager pattern. The finding points at the `new` site.

Not flagged: effects inside functions (including factory functions and IIFEs), effects inside an `$effect.root(...)` callback, classes that are only instantiated inside components, classes imported from another file, effects in class field initializers or static blocks, and effects in anonymous class expressions (`const Store = class { … }`). Detection never crosses a function boundary, so it has no false positives by construction — at the cost of missing cross-file and factory variants.

## Why it matters

The Svelte compiler compiles all of these patterns without a warning; the failure is runtime-only. In development it can go unnoticed (the module may only be imported on certain routes), and in production it surfaces as a crash — typically a 500 on every page that imports the module. Reactive effects can only be created while a component is initialising, or inside an explicit `$effect.root` scope.

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
  import { quizState } from '$lib/store.svelte.ts';
  quizState.startPersisting();
</script>
```
