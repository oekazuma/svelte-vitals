---
title: correctness/unmutated-state · Unmutated $state
description: Use const (or $state.raw) for a $state that is never mutated.
---

**Severity:** info · **Category:** correctness

## What it checks

Flags a `let x = $state(...)` whose value is never written or escaped anywhere in the component — not reassigned, not mutated (`x.a = …`, `x.push()`), not bound (`bind:value={x}`), not passed to a function or component. Checked by static (CLI) analysis of the component script and template.

## Why it matters

A `$state` that is never mutated pays for reactivity — deep proxying and dependency tracking — that it never uses. `const` is clearer and cheaper; `$state.raw` fits when you only ever reassign the value wholesale (never mutate its properties).

## How to fix

```svelte
<script>
  // Instead of: let title = $state('Dashboard');
  const title = 'Dashboard';

  // Reassigned wholesale but never deeply mutated? Use $state.raw:
  let data = $state.raw(initial);
  data = nextValue;
</script>
```
