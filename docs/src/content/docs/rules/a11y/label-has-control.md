---
title: a11y/label-has-control · <label> has no associated control
description: A label needs a for attribute or a wrapped control to be associated with the field it names.
---

**Severity:** warning · **Category:** a11y

## What it checks

Flags a `<label>` with no associated control. Checked from component source, by both the CLI and the Vite plugin — the plugin reads the same `.svelte` files, so the result is identical in either mode. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

Either of the following, if present, associates the label — it is not flagged:

- A `for` attribute — a literal or an expression (its value is unknowable, but the attribute's presence is enough).
- A wrapped labelable descendant: `input` (unless its literal `type` is `hidden`), `select`, `textarea`, `button`, `meter`, `output`, or `progress`.

Not flagged, even with no association found: a label whose content is unknowable — any `{expression}` child, a component child, `{@render …}`, `{@html …}`, a `<slot>` or `<svelte:fragment>` (its content comes from the parent), or a hyphenated custom element (which may be form-associated, and so labelable). The rule only flags what it can prove is unassociated; it never guesses at dynamic content.

```svelte
<label>Name</label>
```

## Why it matters

A `<label>` with no associated control is announced by assistive technology as plain text, not a form label — a screen reader gives no relationship between it and the field it names. Sighted users lose the click-to-focus target the label visually promises, which is why the gap is easy to miss in visual review.

## How to fix

Point `for` at the control's `id`, or wrap the control inside the `<label>`:

```svelte
<label for="name">Name</label>
<input id="name" />

<label>Name <input /></label>
```

## Disabling

If the association is made some other way this rule can't see (e.g. `aria-labelledby` on the control), silence a single element with `<!-- svelte-vitals-disable-next-line a11y/label-has-control -->`, or turn the rule off:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'a11y/label-has-control': 'off'
  }
};
```
