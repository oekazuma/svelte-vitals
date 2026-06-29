---
title: CORRECT002 · Effect used to derive state
description: Use $derived instead of an $effect that only assigns state.
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags an `$effect` whose body only assigns to `$state` variables. Checked by static (CLI) analysis of component instance scripts.

## Why it matters

Synchronising state with an `$effect` (the "useEffect → $effect" habit from React) runs after render and can trigger extra render passes or loops. A `$derived` value expresses the same dependency declaratively and updates synchronously.

## How to fix

```svelte
<script>
  let count = $state(0);
  // Instead of: $effect(() => { double = count * 2; });
  let double = $derived(count * 2);
</script>
```
