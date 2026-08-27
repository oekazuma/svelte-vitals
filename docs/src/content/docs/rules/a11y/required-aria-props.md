---
title: a11y/required-aria-props · Missing required ARIA props
description: A role that requires state or property attributes needs them present, unless native host semantics already supply them.
---

**Severity:** warning · **Category:** a11y

## What it checks

Flags a literal `role` attribute naming a role that requires one or more `aria-*` attributes, when none of those attributes are present on the element.

An attribute counts as present whether its value is a literal or a dynamic expression. Only the attribute's presence matters here, not its value (a bad value is `a11y/invalid-aria-value`'s concern).

A handful of required props are supplied natively by certain host elements, per ARIA-in-HTML, so the explicit attribute isn't needed:

- `aria-checked`, by `<input type="checkbox">` and `<input type="radio">`.
- `aria-selected`, by `<option>`.
- `aria-level`, by `<h1>`–`<h6>`.
- `aria-valuenow`, by `<input type="range">`, `<progress>`, and `<meter>`.
- `aria-expanded` and `aria-controls`, by the native comboboxes: a `<select>` without `multiple` and without a `size` above 1, and an `<input list="…">` whose type is omitted or `text`, `search`, `tel`, `url`, or `email` (HTML-AAM exposes their open state and their popup itself). `<select multiple>` and `<select size="2">` are native listboxes and `<input type="date" list>` is not a combobox, so those still owe both. The Svelte compiler still warns on `<input list role="combobox">` here; this rule stays silent, which is not the opposite verdict.

Not flagged:

- `<div role="checkbox" aria-checked="true">`, where the required prop is present as a literal.
- `<div role="checkbox" aria-checked={checked}>`, where the required prop is present as an expression.
- `<input type="checkbox" role="switch">`, where `aria-checked` (required by `switch`) is supplied by the input's native checkbox semantics.
- A fallback list naming no concrete role at all (`role="bogus alsobogus"`), where there is no role to require anything of. A list that does resolve is checked against the role it resolves to: `role="bogus checkbox"` is checked as `checkbox`.
- An expression-valued role, since its runtime value is unknown statically: `role={dynamicRole}`.

## Why it matters

Some WAI-ARIA roles carry state that assistive technology cannot infer on its own. A `role="checkbox"` with no way to know checked or unchecked announces a control with no discoverable state. The user hears "checkbox" and nothing else, with no visual sign anything is missing.

## How to fix

Add the role's required attribute:

```svelte
<div role="checkbox" aria-checked={checked}>Subscribe</div>
```

Or use the native element that already supplies the state:

```svelte
<input type="checkbox" bind:checked />
```

## Mode differences

None. This rule reads source, the same `.svelte` and `.ts` files, everywhere it runs. The CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

If a required prop is intentionally omitted, silence a single element with `<!-- svelte-vitals-disable-next-line a11y/required-aria-props -->`, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/required-aria-props': 'off'
  }
};
```
