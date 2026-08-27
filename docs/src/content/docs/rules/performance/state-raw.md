---
title: performance/state-raw · Raw state opportunity
description: 'Object/array $state that is only ever reassigned pays for deep reactivity it never uses; $state.raw skips the proxy.'
---

**Severity:** info · **Category:** performance

## What it checks

Flags a top-level object- or array-literal `$state` binding that is reassigned at least once but never mutated:

```svelte
<script>
  let posts = $state([]);

  async function refresh() {
    posts = await fetch('/api/posts').then((r) => r.json()); // reassign-only — $state.raw fits
  }
</script>
```

Detection is deliberately conservative. A candidate survives only if nothing could depend on deep reactivity:

- no property/element writes, `delete`, or method calls;
- no escapes: call arguments, component props, `bind:`, `use:`/`transition:`/`animate:` directive expressions;
- no aliasing references (`const inner = obj.items`, a helper `return obj`, an inline handler storing it elsewhere);
- no item-level edits inside `{#each}` blocks over it or a member path of it (`{#each obj.items as item}` with `bind:value={item.text}` or `<Row {item} />`); an editable list must stay deeply reactive.

## Why it matters

`$state` objects and arrays are wrapped in deep proxies so property-level mutation can be tracked, and that machinery taxes every property access. A binding that is only ever reassigned, API responses being the canonical case, never uses it.

Svelte's own guidance is to use `$state.raw` for large objects that are only ever reassigned. Reassignment stays fully reactive there; only property-level mutation needs the proxy.

## How to fix

```svelte
<script>
  let posts = $state.raw([]);
</script>
```

Keep the same initializer and reassignment code; nothing else changes.

## Limitations

"Large" is not statically knowable, so a literal object/array initializer stands in for it. That also means the `let data = $state(null)`-then-assign idiom is not flagged, since the initializer is not a container literal.

Escape handling is conservative: any aliasing reference disqualifies, a whole-binding `bind:` included; deep aliases that never name the binding (`const x = someAlias.b`) are beyond static reach. Runes-module (`.svelte.ts`) and class-field `$state` are out of scope in this version.

## Mode differences

None. This rule reads source, the same `.svelte` and `.ts` files, everywhere it runs. The CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/state-raw': 'off'
  }
};
```
