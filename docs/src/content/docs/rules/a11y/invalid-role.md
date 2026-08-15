---
title: a11y/invalid-role · Invalid ARIA role
description: A role attribute should name a concrete WAI-ARIA role, not a typo or an abstract role.
---

**Severity:** warning · **Category:** a11y

## What it checks

Flags a literal `role` attribute whose value is not a valid, concrete WAI-ARIA role. Checked by static (CLI) analysis of every `.svelte` component under `src/`.

A `role` may list a fallback list of space-separated tokens (`role="switch checkbox"`); every token is checked individually. Two things get flagged:

- **Unknown tokens** — typos or made-up role names, e.g. `role="botton"`.
- **Abstract roles** — roles that exist only to organize the WAI-ARIA taxonomy and are never meant to be used directly, e.g. `role="widget"` or `role="input"`.

Not flagged:

- A concrete role: `role="button"`.
- A fallback list where every token is concrete: `role="switch checkbox"`.
- An expression-valued role, since its runtime value is unknown statically: `role={dynamicRole}`.

## Why it matters

Assistive technology maps `role` to a fixed WAI-ARIA vocabulary. A role it doesn't recognize — a typo or an abstract role — is ignored or misread, so the element falls back to its implicit (often generic) semantics. The author's intent to announce the element as a button, switch, or dialog is silently lost, with no visual sign anything is wrong.

## How to fix

Use a concrete WAI-ARIA role, or drop the attribute if the element's native semantics already say what you need:

```svelte
<div role="button">Click</div>
```

## Disabling

If a role is intentionally non-standard, silence a single element with `<!-- svelte-vitals-disable-next-line a11y/invalid-role -->`, or turn the rule off:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'a11y/invalid-role': 'off'
  }
};
```
