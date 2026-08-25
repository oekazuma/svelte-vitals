---
title: a11y/positive-tabindex · Positive tabindex
description: A tabindex above 0 puts the element ahead of every naturally-ordered element on the page — a single tabindex="1" reorders keyboard navigation globally.
---

**Severity:** warning · **Category:** a11y

## What it checks

Flags an element with a literal `tabindex` attribute whose value parses to an integer greater than 0:

```svelte
<div tabindex="1">Jumps the tab queue</div>
```

Not flagged:

- `tabindex="0"` — the element joins the natural tab order.
- `tabindex="-1"` — the element is programmatically focusable only.
- An expression-valued `tabindex={expr}` — the rendered value is unknowable statically.
- A blank or non-numeric `tabindex` — invalid HTML, ignored by browsers.

## Why it matters

Elements with a positive `tabindex` come before every naturally-ordered element on the page, so a single `tabindex="1"` reorders keyboard navigation for the whole document — and the damage compounds: every element added later without a positive `tabindex` sorts after it, no matter where it sits visually. The tab order then diverges from the visual order, which WCAG 2.4.3 (Focus Order) requires to stay meaningful. The universally-agreed guidance is that only `0` and `-1` are safe values; a positive value is essentially never intentional-and-correct.

## How to fix

Put elements in DOM order and let the natural tab sequence do the work, using `tabindex="0"` only to add a non-interactive element to it:

```svelte
<div tabindex="0" role="button">In the natural order</div>
```

Use `tabindex="-1"` for elements you focus programmatically (e.g. a skip-link target or a dialog):

```svelte
<div tabindex="-1" bind:this={panel}>Focused from code</div>
```

## Limitations

Only literal `tabindex` values on native elements are covered. An expression-valued `tabindex`, a spread attribute that supplies one, and a dynamic tag via `<svelte:element>` are out of static reach and are not flagged.

## Mode differences

None. This rule reads source — the same `.svelte` files — on every surface: the CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

If a positive value is genuinely intended, silence a single element with `<!-- svelte-vitals-disable-next-line a11y/positive-tabindex -->`, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/positive-tabindex': 'off'
  }
};
```
