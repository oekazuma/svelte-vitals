---
title: correctness/each-index-key · Index used as each key
description: Keying an {#each} block by its index gives items position-based identity, the same bug as no key, only masked.
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags an `{#each}` block whose key is exactly its index binding, e.g. `{#each items as item, i (i)}`.

Trivial stringifications of the index are flagged too, including `(String(i))`, `(Number(i))`, ``(`${i}`)``, `(i.toString())`, `(i + '')`, and TS-wrapped forms such as `(i!)`: they are still position-based identity.

Not flagged:

- **Composite keys** carrying the index alongside item data (`(item.id + '-' + i)`, ``(`${item.id}-${i}`)``). Appending an index is sometimes a deliberate workaround for duplicate items, where a bare item key would throw Svelte's duplicate-key error. The trade-off: such a key still changes when an item moves, so moved items are destroyed and recreated rather than tracked. Prefer a truly unique id where you can.
- **Length-only placeholder lists** (`{#each [...Array(n)] as _, i (i)}` and friends), which have no item identity at all.

## Why it matters

Svelte's guidance is explicit: the key must uniquely identify the object, so do not use the index.

An index key makes identity follow list position, so on reorder, insert or remove, element state (focus, input values, transitions) sticks to positions instead of items, exactly the failure mode of an unkeyed block. Worse, the visible key makes the block look safe, so it tends to surface in production rather than review.

## How to fix

Key by a value that uniquely identifies the item:

```svelte
{#each items as item (item.id)}
  <li>{item.name}</li>
{/each}
```

## Mode differences

None. This rule reads source, the same `.svelte` and `.ts` files, everywhere it runs. The CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

If a list provably never reorders and never has mid-list insertions or removals, you can silence a single block with `<!-- svelte-vitals-disable-next-line correctness/each-index-key -->`, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'correctness/each-index-key': 'off'
  }
};
```
