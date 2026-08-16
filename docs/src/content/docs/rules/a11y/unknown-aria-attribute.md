---
title: a11y/unknown-aria-attribute · Unknown ARIA attribute
description: An aria-* attribute should name a real WAI-ARIA attribute, not a typo.
---

**Severity:** warning · **Category:** a11y

## What it checks

Flags an `aria-*` attribute whose name is not defined by the WAI-ARIA spec. Checked from component source, by both the CLI and the Vite plugin — the plugin reads the same `.svelte` files, so the result is identical in either mode. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

Only the attribute _name_ is checked, not its value — a bad value on a real attribute is `a11y/invalid-aria-value`'s concern. Because of that, an unrecognized name is flagged the same way whether its value is a literal or a dynamic expression:

- `aria-lable="x"` — flagged, misspelled name.
- `aria-lable={x}` — flagged, same misspelled name, dynamic value.

Not flagged:

The attribute vocabulary comes from a pinned copy of the ARIA data, extended by hand with the attributes ARIA 1.3 added after that copy. An attribute newer than both is reported as unknown until the data is updated.

- Any spec-defined attribute, e.g. `aria-label="x"`.
- A spec-defined attribute with a dynamic value, e.g. `aria-hidden={isHidden}`.

## Why it matters

Assistive technology only recognizes the fixed set of `aria-*` attributes the WAI-ARIA spec defines. An unrecognized name — usually a typo like `aria-lable` for `aria-label` — is not an error the browser or screen reader can report; it's simply ignored, so the intended announcement never happens and nothing looks wrong visually.

## How to fix

Use the correctly spelled, spec-defined attribute:

```svelte
<button aria-label="Close">×</button>
```

## Disabling

If an attribute is intentionally non-standard, silence a single element with `<!-- svelte-vitals-disable-next-line a11y/unknown-aria-attribute -->`, or turn the rule off:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'a11y/unknown-aria-attribute': 'off'
  }
};
```
