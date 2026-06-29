---
title: CORRECT001 · Keyed each block
description: An {#each} block over dynamic data should have a key.
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags an `{#each}` block with no key. Checked by static (CLI) analysis of every `.svelte` component under `src/`.

## Why it matters

Without a key, Svelte destroys and recreates the DOM nodes of a list when it reorders or items are inserted/removed — losing element state (focus, inputs, transitions) and doing extra work. A key lets Svelte match and move existing nodes instead.

## How to fix

```svelte
{#each items as item (item.id)}
  <li>{item.name}</li>
{/each}
```
