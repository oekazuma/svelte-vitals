---
title: correctness/stale-prop-derivation · Stale prop derivation
description: 'A value computed from a prop without $derived is evaluated once — the UI silently stops tracking the parent.'
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags a top-level `const`/`let` whose initializer is computed from a `$props()` prop without `$derived`, when that binding is rendered in the template:

```svelte
<script>
  let { type } = $props();

  // flagged — freezes the first render's value
  let color = type === 'danger' ? 'red' : 'green';
</script>

<p class={color}>...</p>
```

Detection is deliberately conservative — all of these must hold:

- The initializer references a prop in an **eager position**; references inside functions, arrow bodies or getters stay reactive and don't count.
- It contains no function call, `new`, or `await`, which structurally exempts `$state(initial)` capture, `$derived`, and service construction.
- The binding is never reassigned or passed around.
- It is actually rendered; bindings used only inside event handlers don't count.

## Why it matters

Svelte's guidance is to treat props as though they will change. The plain form evaluates once, at initialization: the component renders correctly on first mount and silently stops tracking the parent afterwards — a stale-UI bug that survives review and surfaces in production, because nothing in the compiler or svelte-check warns about it.

## How to fix

```svelte
<script>
  let { type } = $props();

  let color = $derived(type === 'danger' ? 'red' : 'green');
</script>
```

Use `$derived.by(() => ...)` when the computation needs a function body. If you genuinely want a one-time snapshot (an uncontrolled component's initial value), `let value = $state(initialValue)` is the documented pattern — and it is not flagged.

### Legacy mode (`export let`)

The same bug exists in legacy-mode components, with a different fix — Svelte can't mix `export let` and `$props()` in one file, so this rule recognizes both prop styles and tailors its message accordingly:

```svelte
<script>
  export let type;

  // flagged — freezes the first render's value
  let color = type === 'danger' ? 'red' : 'green';
</script>
```

```svelte
<script>
  export let type;

  $: color = type === 'danger' ? 'red' : 'green';
</script>
```

Prefixing the assignment with `$:` (a reactive statement) is the legacy-mode equivalent of `$derived` — it re-runs whenever `type` changes, instead of only once at initialization.

## Limitations

The call-free restriction means method derivations (`type.toUpperCase()`, `items.filter(...)`) go undetected in v1 — a precision-first trade-off; a future version may allow-list pure built-ins.

The rule cannot know whether the parent ever changes the prop, but `$derived` costs nothing even when it doesn't. Note the interplay with `correctness/unmutated-state`: for never-written `$state` computed from a prop, the fix is `$derived`, not `const`.

## Disabling

```js svelte-vitals.config.js
export default {
  rules: {
    'correctness/stale-prop-derivation': 'off'
  }
};
```
