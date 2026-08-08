---
title: correctness/instance-browser-global · Browser global during component initialisation
description: A component's instance script runs on the server during SSR — window/document reads at its top level crash the render.
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags reads of browser-only globals (the same list as [correctness/server-browser-global](/rules/correctness/server-browser-global)) at the **top level of a component's `<script>`** — that code runs on the server on every SSR render of the component. The same guards apply: `browser` from `$app/environment`, `typeof` checks (early-return guards included), `onMount`/`$effect` bodies, your own bindings, and shadowed locals are never flagged.

## Why it matters

`const width = window.innerWidth;` at the top of a component works in the browser and in a client-only dev flow, then crashes the first SSR render with `ReferenceError: window is not defined`.

This is a **warning**, not critical: a component that is only ever rendered behind a parent's `{#if browser}` (or dynamically imported on the client) legitimately never runs on the server — and that cannot be proven from the component file alone. If that is your case, add `// svelte-vitals-disable-next-line correctness/instance-browser-global` above the line.

A browser global used only as a `$props()` destructuring default (`let { width = window.innerWidth } = $props()`) is not flagged either — the default only evaluates when the prop is absent, including during SSR, but the scanner doesn't visit destructuring defaults. This is a silent conservative miss, not a guard.

## How to fix

The preferred modern form for a `window` property is [`svelte/reactivity/window`](https://svelte.dev/docs/svelte/svelte-reactivity-window) (5.11.0+) — no guard needed, `undefined` on the server, reactive on the client:

```svelte
<script>
  const width = window.innerWidth; // ❌ crashes SSR

  import { innerWidth } from 'svelte/reactivity/window';
</script>

<p>{innerWidth.current}</p>
```

For anything `svelte/reactivity/window` doesn't cover, read the global in `onMount` — it never runs on the server:

```svelte
<script>
  import { onMount } from 'svelte';

  let width2 = $state(0);
  onMount(() => {
    width2 = window.innerWidth; // ✅ onMount never runs on the server
  });
</script>
```
