---
title: correctness/effect-as-onmount · Effect used as onMount
description: An $effect that reads no reactive value belongs in an event handler, {@attach}, or onMount instead.
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags an `$effect` / `$effect.pre` whose non-empty body reads no reactive value that this analysis can see — no `$state`, `$derived`, `$props`, imported binding, local declared with a `new …()` initializer, or store subscription, and no bare function call (`foo()`). Such an effect runs once after mount and never re-runs on the paths this check can follow.

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

Name matching is by identifier text, not lexical scope — the same granularity this rule has always used for rune names — so a callback-local binding that shadows an imported or `new`-declared name (e.g. a parameter reusing that name) is still treated as reactive. That can only suppress a finding, never wrongly flag one.

If that's your case, suppress it with a
[`svelte-vitals-disable-next-line`](/guides/cli#suppressing-a-single-finding-inline) comment rather than moving working code into `onMount`.

## Mode differences

None. This rule reads source — the same `.svelte` and `.ts` files — on every surface: the CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

Silence a single occurrence with `<!-- svelte-vitals-disable-next-line correctness/effect-as-onmount -->` on the line above it, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'correctness/effect-as-onmount': 'off'
  }
};
```
