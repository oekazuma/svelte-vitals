---
title: correctness/each-index-key · Index used as each key
description: Keying an {#each} block by its index gives items position-based identity — the same bug as no key, masked.
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags an `{#each}` block whose key is exactly its index binding, e.g. `{#each items as item, i (i)}`. Checked by static (CLI) analysis of every `.svelte` component under `src/`.

Trivial stringifications of the index — `(String(i))`, `(Number(i))`, ``(`${i}`)``, `(i.toString())`, `(i + '')`, and TS-wrapped forms including `(i!)` — are flagged too: they are still position-based identity.

Not flagged: composite keys that contain the index alongside item data (`(item.id + '-' + i)`, ``(`${item.id}-${i}`)``) — appending an index is sometimes a deliberate workaround for lists with duplicate items, where a bare item key would throw Svelte's duplicate-key error. Note the trade-off: such a key still changes when an item moves position, so moved items are destroyed and recreated instead of tracked — prefer a truly unique id when you can. Also not flagged: length-only placeholder lists — `{#each [...Array(n)] as _, i (i)}` and friends — have no item identity and are skipped entirely.

## Why it matters

Svelte's own guidance is explicit: the key must uniquely identify the object — do not use the index as a key. An index key makes item identity follow list position, so when the list reorders or items are inserted or removed, element state (focus, input values, transitions) sticks to positions instead of items — exactly the failure mode of an unkeyed block. Worse, the visible key makes the block look safe, so the bug tends to surface in production instead of review.

## How to fix

Key by a value that uniquely identifies the item:

```svelte
{#each items as item (item.id)}
  <li>{item.name}</li>
{/each}
```

## Disabling

If a list provably never reorders and never has mid-list insertions or removals, you can silence a single block with `<!-- svelte-vitals-disable-next-line correctness/each-index-key -->`, or turn the rule off:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/each-index-key': 'off'
  }
};
```
