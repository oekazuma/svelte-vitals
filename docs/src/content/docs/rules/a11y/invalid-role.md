---
title: a11y/invalid-role · Invalid ARIA role
description: A role attribute should name a concrete WAI-ARIA role, not a typo or an abstract role.
---

**Severity:** warning · **Category:** a11y

## What it checks

Flags a literal `role` attribute whose value is not a valid, concrete WAI-ARIA role.

A `role` may hold a space-separated fallback list (`role="switch checkbox"`). A user agent resolves it to the **first token naming a concrete role**, so the rule reports only a value that resolves to nothing at all. Two things get flagged:

- **Unknown roles** — typos or made-up names, e.g. `role="botton"`.
- **Abstract roles** — roles that exist only to organize the WAI-ARIA taxonomy and are never meant to be used directly, e.g. `role="widget"` or `role="input"`.

Not flagged:

- A concrete role: `role="button"`.
- Any fallback list in which some token is concrete: `role="switch checkbox"`, and equally `role="widget checkbox"` or `role="checkbox some-future-role"` — the list form exists so a value can name a role older user agents do not know.
- An expression-valued role, since its runtime value is unknown statically: `role={dynamicRole}`.

The role vocabulary comes from a pinned copy of the ARIA data, extended by hand with the roles ARIA 1.3 added after that copy. A role newer than both is reported as unknown until the data is updated.

## Why it matters

Assistive technology maps `role` to a fixed WAI-ARIA vocabulary. A role it doesn't recognize — a typo or an abstract role — is ignored or misread, so the element falls back to its implicit (often generic) semantics. The author's intent to announce the element as a button, switch, or dialog is silently lost, with no visual sign anything is wrong.

## How to fix

Use a concrete WAI-ARIA role, or drop the attribute if the element's native semantics already say what you need:

```svelte
<div role="button">Click</div>
```

## Mode differences

None. This rule reads source — the same `.svelte` and `.ts` files — on every surface: the CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

If a role is intentionally non-standard, silence a single element with `<!-- svelte-vitals-disable-next-line a11y/invalid-role -->`, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/invalid-role': 'off'
  }
};
```
