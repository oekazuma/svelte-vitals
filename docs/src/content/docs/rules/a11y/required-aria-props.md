---
title: a11y/required-aria-props · Missing required ARIA props
description: A role that requires state or property attributes needs them present, unless native host semantics already supply them.
---

**Severity:** warning · **Category:** a11y

## What it checks

Flags a literal `role` attribute naming a role that requires one or more `aria-*` attributes, when none of those attributes are present on the element. Checked by static (CLI) analysis of every `.svelte` component under `src/`.

An attribute counts as present whether its value is a literal or a dynamic expression — only the attribute's presence matters here, not its value (a bad value is `a11y/invalid-aria-value`'s concern).

A handful of required props are supplied natively by certain host elements, per ARIA-in-HTML, so the explicit attribute isn't needed:

- `aria-checked` — by `<input type="checkbox">` and `<input type="radio">`.
- `aria-selected` — by `<option>`.
- `aria-level` — by `<h1>`–`<h6>`.
- `aria-valuenow` — by `<input type="range">`, `<progress>`, and `<meter>`.

Not flagged:

- `<div role="checkbox" aria-checked="true">` — required prop present as a literal.
- `<div role="checkbox" aria-checked={checked}>` — required prop present as an expression.
- `<input type="checkbox" role="switch">` — `aria-checked` (required by `switch`) is supplied by the input's native checkbox semantics.
- A fallback list of roles (`role="switch checkbox"`) — a user agent applies the first token naming a concrete role, and reading the list either way risks a false positive; the rule skips fallback lists entirely.
- An expression-valued role, since its runtime value is unknown statically: `role={dynamicRole}`.

## Why it matters

Some WAI-ARIA roles carry state that assistive technology cannot infer on its own. A `role="checkbox"` with no way to know checked or unchecked announces a control with no discoverable state — the user hears "checkbox" and nothing else, with no visual sign anything is missing.

## How to fix

Add the role's required attribute:

```svelte
<div role="checkbox" aria-checked={checked}>Subscribe</div>
```

Or use the native element that already supplies the state:

```svelte
<input type="checkbox" bind:checked />
```

## Disabling

If a required prop is intentionally omitted, silence a single element with `<!-- svelte-vitals-disable-next-line a11y/required-aria-props -->`, or turn the rule off:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'a11y/required-aria-props': 'off'
  }
};
```
