---
title: correctness/nonreactive-builtin-state · Non-reactive built-in in $state
description: 'A plain Map, Set, Date, URL, or URLSearchParams in $state is not proxied — its mutations are invisible to reactivity, and the UI silently stops updating.'
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags a top-level `$state` binding constructed from a plain built-in — `Map`, `Set`, `Date`, `URL`, or `URLSearchParams` — when a mutation of that instance is observed inside a function or template handler:

```svelte
<script>
  let tags = $state(new Set());

  function toggle(tag) {
    tags.add(tag); // flagged — this mutation is not tracked
  }
</script>

{#each [...tags] as tag}<span>{tag}</span>{/each}
```

Detection is deliberately conservative:

- Only type-specific mutating operations count (`map.set`, `set.add`, `date.setHours`, `params.append`, `url.href = …`, `url.searchParams.set(…)`, …); read methods never do.
- A binding reassigned after mutation (`tags = new Set(tags)`) works correctly and is exempt. The bare self-assignment `tags = tags` is a no-op in Svelte 5 and is not.
- Mutations at script top level run once before the first render, so they are exempt too.

## Why it matters

`$state`'s deep proxy covers plain objects and arrays only. A built-in instance keeps working as data — every `set`/`add`/`append` succeeds — but reactivity never hears about it: effects don't rerun, deriveds don't recompute, the template keeps the old contents.

The component renders correctly once, then silently stops updating, with no compiler or svelte-check warning. Svelte ships `svelte/reactivity` precisely for this.

## How to fix

```svelte
<script>
  import { SvelteSet } from 'svelte/reactivity';

  let tags = new SvelteSet();
</script>
```

`SvelteMap`, `SvelteSet`, `SvelteDate`, `SvelteURL`, and `SvelteURLSearchParams` are drop-in replacements with identical APIs. Alternatively, keep the plain built-in and reassign a fresh instance after each change (`tags = new Set(tags)`) — the rule recognizes that pattern and stays quiet.

## Limitations

Out of reach or out of scope:

- Mutations outside the component — an instance passed to a helper, store or child that mutates it. The rule counts only what it can see, so escape-only usage is never flagged.
- A local class shadowing a built-in name (`class Map { … }`) would be misattributed; shadowing global built-ins is its own problem.
- Runes-module (`.svelte.ts`) and class-field `$state`, in this version.

## Mode differences

None. This rule reads source — the same `.svelte` and `.ts` files — on every surface: the CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

```js svelte-vitals.config.js
export default {
  rules: {
    'correctness/nonreactive-builtin-state': 'off'
  }
};
```
