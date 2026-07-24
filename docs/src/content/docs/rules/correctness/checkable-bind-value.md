---
title: correctness/checkable-bind-value · bind:value on a checkable input
description: 'bind:value on a checkbox or radio input binds the DOM value property, which checkbox/radio interaction never changes — the bound state silently never updates.'
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags a native `<input type="checkbox">` or `<input type="radio">` element that carries a `bind:value` directive:

```svelte
<input type="checkbox" bind:value={subscribed} />
```

`bind:value` binds the DOM `value` property. A checkbox/radio's user interaction toggles *checkedness*, not `value` — so `subscribed` is frozen at its initial value and never updates when the user clicks the checkbox.

Detection is template-only and static: the `type` attribute must be a literal `"checkbox"` or `"radio"` — a dynamic `type={expr}`, or a dynamic tag via `<svelte:element this="input" …>`, is out of static reach and is not flagged. A plain `value="…"` attribute (not the `bind:value` directive) is the correct pattern for `bind:group` and is never confused with the flagged case.

## Why it matters

Svelte's own compiler accepts `bind:value` on a checkbox or radio input without any warning or error — verified directly against Svelte 5 (`svelte.compile()` reports zero warnings for this pattern). The component renders correctly once (the bound variable's initial value shows), and then silently stops updating the moment the user interacts with the input. Nothing surfaces the bug in development; it shows up as "the form doesn't save changes" in production.

## How to fix

For a single checkbox, bind the checked state directly:

```svelte
<input type="checkbox" bind:checked={subscribed} />
```

For a checkbox list or radio group, bind the group instead — each input keeps its own static `value` to identify the option:

```svelte
<input type="radio" bind:group={selected} value="a" />
<input type="radio" bind:group={selected} value="b" />
```

## Limitations

Only native `<input>` elements with a statically-literal `type` are covered. A dynamic `type={expr}`, `<svelte:element this="input" …>`, `<select bind:value>`, and custom components that accept a `bind:value`-shaped prop (e.g. a hand-rolled `<Checkbox bind:value>`) are all out of static reach and are not flagged.

## Disabling

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/checkable-bind-value': 'off'
  }
};
```
