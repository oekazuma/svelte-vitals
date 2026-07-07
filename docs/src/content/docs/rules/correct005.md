---
title: CORRECT005 · Mutated non-bindable prop
description: Don't mutate a prop from $props() unless it is declared $bindable.
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags a mutation of a value destructured from `$props()` that is not declared `$bindable`: a member write (`user.name = …`, `obj.count += 1`), `delete obj.x`, or a call to a mutating method (`items.push(…)`, `arr.splice(…)`, `map.set(…)`, …). A `...rest` binding is tracked too — rest props can never be individually declared `$bindable`. Plain reassignment of the prop itself (`count = 5`) is **not** flagged — Svelte's docs explicitly sanction temporary reassignment for unsaved ephemeral state; only mutation is prohibited. Checked by static (CLI) analysis of the component script and template.

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
