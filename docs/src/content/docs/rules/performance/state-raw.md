---
title: performance/state-raw · Raw state opportunity
description: 'Object/array $state that is only ever reassigned pays for deep reactivity it never uses — $state.raw skips the proxy.'
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

Detection is deliberately conservative. A candidate survives only if nothing could depend on deep reactivity: no property/element writes, `delete`, or method calls; no escapes (call arguments, component props, `bind:`); no aliasing references (`const inner = obj.items`, a helper `return obj`, an inline handler storing it elsewhere); and no item-level edits inside `{#each}` blocks over it (`bind:value={item.text}`, `<Row {item} />` — an editable list must stay deeply reactive).

## Why it matters

`$state` objects and arrays are wrapped in deep proxies so property-level mutation can be tracked — and that machinery taxes every property access. A binding that is only ever reassigned (API responses are the canonical case) never uses it. Svelte's own guidance: use `$state.raw` for large objects that are only ever reassigned. Reassignment stays fully reactive under `$state.raw`; only property-level mutation needs the proxy.

## How to fix

```svelte
<script>
  let posts = $state.raw([]);
</script>
```

Keep the same initializer and reassignment code — nothing else changes.

## Limitations

"Large" is not statically knowable, so a literal object/array initializer stands in for it — which also means the `let data = $state(null)`-then-assign idiom is not flagged (the initializer is not a container literal). Escape handling is conservative: any aliasing reference disqualifies, including a whole-binding `bind:`; deep aliases that never name the binding (`const x = someAlias.b`) are beyond static reach. Runes-module (`.svelte.ts`) and class-field `$state` are out of scope in this version.

## Disabling

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'performance/state-raw': 'off'
  }
};
```
