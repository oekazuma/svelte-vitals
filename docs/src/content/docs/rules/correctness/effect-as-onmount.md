---
title: correctness/effect-as-onmount · Effect used as onMount
description: Use onMount for an $effect that reads no reactive value.
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags an `$effect` / `$effect.pre` whose non-empty body reads no reactive value — no `$state`, `$derived`, or `$props`, no store subscription, and no bare function call (`foo()`). Such an effect runs once after mount and never re-runs. Checked by static (CLI) analysis of component instance scripts.

## Why it matters

An `$effect` that never reacts to anything is an `onMount` in disguise. Using `$effect` obscures that intent and misuses the reactivity system; `onMount` says "run this once when the component mounts" directly.

## How to fix

```svelte
<script>
  import { onMount } from 'svelte';
  // Instead of: $effect(() => { element.focus(); });
  onMount(() => {
    element.focus();
  });
</script>
```
