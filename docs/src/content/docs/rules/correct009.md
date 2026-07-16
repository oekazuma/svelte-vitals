---
title: CORRECT009 · Browser global during component initialisation
description: A component's instance script runs on the server during SSR — window/document reads at its top level crash the render.
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags reads of browser-only globals (the same list as [CORRECT008](/svelte-vitals/rules/correct008)) at the **top level of a component's `<script>`** — that code runs on the server on every SSR render of the component. The same guards apply: `browser` from `$app/environment`, `typeof` checks, `onMount`/`$effect` bodies, your own bindings, and shadowed locals are never flagged.

## Why it matters

`const width = window.innerWidth;` at the top of a component works in the browser and in a client-only dev flow, then crashes the first SSR render with `ReferenceError: window is not defined`.

This is a **warning**, not critical: a component that is only ever rendered behind a parent's `{#if browser}` (or dynamically imported on the client) legitimately never runs on the server — and that cannot be proven from the component file alone. If that is your case, add `// svelte-vitals-disable-next-line CORRECT009` above the line.

## How to fix

```svelte
<script>
  const width = window.innerWidth; // ❌ crashes SSR

  let width2 = $state(0);
  $effect(() => {
    width2 = window.innerWidth; // ✅ client-only
  });
</script>
```
