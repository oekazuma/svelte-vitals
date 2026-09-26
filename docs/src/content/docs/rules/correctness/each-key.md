---
title: correctness/each-key · Keyed each block
description: An {#each} block over dynamic data should have a key.
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags an `{#each}` block with no key. A few shapes are ignored:

- A constant inline array literal (`{#each [1, 2, 3] as n}`): it has a fixed length and never reorders, so a key cannot help.
- The same literal given a name in the component's own script (`const tabs = [ … ]`, not exported), when nothing in the file can change it: every other mention is a member read (`tabs.length`), an `{#each tabs …}`, a `for (const t of tabs)` loop or a copy into a new array (`[...tabs, extra]`). A mutating call (`tabs.push`), an assignment through it, or passing `tabs` or spreading it anywhere else keeps it reported.
- The same literal imported from a module in the project (`export const TABS = [ … ]`, `as const` and `satisfies` included), reached through `$lib` or another `kit.alias`, a relative path, or a barrel's re-exports (a runes module named without its extension, `$lib/state.svelte` for `state.svelte.ts`, included), and iterated as `TABS` or as `ns.TABS` of `import * as ns`. The module must not write it, and the component is held to the reads above. A list from a package, a JSON file, or an export that is not an array literal (`LIST.map(…)`, spreads) is still reported. Writes from other modules that import the same list are not checked.
- An itemless each (`{#each { length: 8 }, i}`, the "render N times" pattern): there is no item identity to key on; the only possible key is the index itself, which is a no-op.
- Length-only lists (`Array(n)`, `[...Array(n)]`, `Array.from({ length: n })`, `Array.from(new Array(n))`, the same followed by `.fill(x)` or `.keys()`, `{ length: n }` with an item binding such as `as _`): placeholder and skeleton lists with a fixed, order-free shape a key cannot help.

## Why it matters

Without a key, a reorder or an insert/remove makes Svelte add or remove nodes at the end and rewrite the data of everything in between: element state (focus, inputs, transitions) sticks to positions instead of items, and extra work is done. A key lets Svelte insert, move and delete the right nodes instead.

## How to fix

```svelte
{#each items as item (item.id)}
  <li>{item.name}</li>
{/each}
```

## Mode differences

None. This rule reads source, the same `.svelte` and `.ts` files, everywhere it runs. The CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

Silence a single occurrence with `<!-- svelte-vitals-disable-next-line correctness/each-key -->` on the line above it, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'correctness/each-key': 'off'
  }
};
```
