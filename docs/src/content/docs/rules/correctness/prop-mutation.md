---
title: correctness/prop-mutation · Mutated non-bindable prop
description: Don't mutate a prop from $props() unless it is declared $bindable.
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags a mutation of a value destructured from `$props()` that is not declared `$bindable`: a member write (`user.name = …`, `obj.count += 1`), `delete obj.x`, or a mutating method call (`items.push(…)`, `arr.splice(…)`, `map.set(…)`, …). A `...rest` binding is tracked too, since rest props can never be individually declared `$bindable`.

Plain reassignment of the prop itself (`count = 5`) is **not** flagged: Svelte's docs explicitly sanction temporary reassignment for unsaved ephemeral state. Only mutation is prohibited. Static (CLI) analysis of the component script and template.

A local reusing the prop's name shadows it and is not the prop at all, so mutating it is not flagged: a function or arrow parameter, a block-scoped `let`/`const` redeclaration, a `for`/`for-of`/`for-in` loop variable, a `catch` parameter, or a `{#each ... as x}` variable.

`{#snippet}`/`{:then}`/`{:catch}` bindings are not tracked and could still produce a false positive — a deliberately partial mitigation, not full scope resolution.

## Why it matters

Svelte's docs say plainly: "don't mutate props" unless they are `$bindable`. Three failure modes, none caught by the compiler:

- A **plain-object** prop mutation is a silent no-op — the object isn't a state proxy, so not even the dev-time warning fires.
- A **reactive-state-proxy** prop mutation works, but triggers the `ownership_invalid_mutation` dev warning — only if that code path is actually exercised at runtime.
- A **fallback value** in use behaves like a plain object — mutation has no effect.

Static analysis catches all three at review/CI time, before the code path has to run.

## How to fix

```svelte
<script>
  let { user } = $props();

  // Instead of mutating the prop directly:
  function rename(name) {
    user.name = name; // no-op or ownership_invalid_mutation warning
  }

  // Clone before mutating:
  function rename(name) {
    const next = { ...user, name };
    // ...use `next`, or lift the change to the parent
  }

  // Or make it bindable, if the parent and child should share it:
  let { user = $bindable() } = $props();
</script>
```

### Legacy mode (`export let`)

The same class of bug exists in legacy-mode components, for a different reason — Svelte's legacy reactivity is assignment-based, so a mutating method call never triggers an update on its own, even when the prop is passed with `bind:`:

```svelte
<script>
  export let items;

  // flagged — the mutation itself doesn't trigger an update
  function addItem(item) {
    items.push(item);
  }
</script>
```

Reassign the prop after mutating it to re-trigger reactivity — this is Svelte's own documented pattern, not a workaround:

```svelte
<script>
  export let items;

  function addItem(item) {
    items.push(item);
    items = items; // tells the compiler `items` changed
  }
</script>
```
