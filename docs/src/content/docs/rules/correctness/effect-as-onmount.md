---
title: correctness/effect-as-onmount · Effect used as onMount
description: An $effect that reads no reactive value belongs in an event handler, {@attach}, or onMount instead.
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags an `$effect` / `$effect.pre` whose non-empty body reads no reactive value that this analysis can see — no `$state`, `$derived`, `$props`, imported binding, local declared with a `new …()` initializer, or store subscription, and no bare function call (`foo()`). Such an effect runs once after mount and never re-runs on the paths this check can follow. Checked by static (CLI) analysis of component instance scripts.

## Why it matters

An `$effect` that never reacts to anything is usually a slower, less direct stand-in for an event handler, `{@attach}`, or `onMount`. Using `$effect` for it obscures intent and misuses the reactivity system.

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

If the effect runs in response to a user interaction, prefer an event handler over `$effect`. If it syncs an element with an external library (e.g. a chart or a tooltip), prefer [`{@attach ...}`](https://svelte.dev/docs/svelte/@attach) (5.29+) instead — it's the current recommended way to do DOM/library sync, ahead of both `$effect` and `onMount`.

## Known limitations

This check recognizes a reactive read through a name it can trace back to a rune declarator (`$state`/`$derived`/`$props`), an imported binding, or a local declared with a `new …()` initializer (`const x = new Foo()`) — which covers class `$state` fields, `SvelteMap`/`SvelteSet`, an imported runes-module state object, and `svelte/reactivity/window`. Two shapes have no such name to trace, so a genuinely reactive effect built either way can still be flagged:

- A reactive value reached only through a plain function's return value (`const c = createCounter()`).
- A local assigned `new …()` after its declaration instead of at it (`let m; m = new SvelteMap();`) — only the declarator-init form is recognized.

If that's your case, suppress it with a
[`svelte-vitals-disable-next-line`](/guides/cli#suppressing-a-single-finding-inline) comment rather than moving working code into `onMount`.
