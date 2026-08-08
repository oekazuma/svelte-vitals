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

`bind:value` binds the DOM `value` property. A checkbox/radio's user interaction toggles _checkedness_, not `value` — so `subscribed` is frozen at its initial value and never updates when the user clicks the checkbox.

Detection is template-only and static: the `type` attribute must be a literal `"checkbox"` or `"radio"`. A dynamic `type={expr}`, or a dynamic tag via `<svelte:element this="input" …>`, is out of static reach. A plain `value="…"` attribute — not the `bind:value` directive — is the correct pattern for `bind:group` and is never confused with the flagged case.

## Why it matters

Nothing is caught at compile time: `svelte.compile()` reports zero warnings for the pattern, verified against Svelte 5.

At runtime the two inputs diverge. A **checkbox** throws `bind_invalid_checkbox_value` ("Using `bind:value` together with a checkbox input is not allowed. Use `bind:checked` instead") — but only in a development build. In production the check is skipped and the binding silently tracks the `value` attribute instead of checkedness, which behaves like the radio case below. A **radio** throws nothing in either build: it renders correctly once, showing the bound variable's initial value, then silently stops updating the moment the user interacts with it — nothing surfaces it in development, and it shows up as "the form doesn't save changes" in production.

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
