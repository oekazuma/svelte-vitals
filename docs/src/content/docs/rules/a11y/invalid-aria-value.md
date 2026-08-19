---
title: a11y/invalid-aria-value · Invalid ARIA attribute value
description: An aria-* attribute's value should match the type the WAI-ARIA spec defines for it.
---

**Severity:** warning · **Category:** a11y

## What it checks

Flags a literal `aria-*` attribute whose value does not match the type the WAI-ARIA spec defines for that attribute. Checked from component source, by both the CLI and the Vite plugin — the plugin reads the same `.svelte` files, so the result is identical in either mode. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

Only attributes the spec defines are checked here — an unrecognized name is `a11y/unknown-aria-attribute`'s concern, not this rule's. Each spec type is validated differently:

- **boolean** (e.g. `aria-hidden`) — must be `true` or `false`.
- **tristate** (e.g. `aria-checked`) — must be `true`, `false`, or `mixed`.
- **token** (e.g. `aria-live`) — must be one of the attribute's fixed set of values.
- **tokenlist** (e.g. `aria-relevant`) — one or more whitespace-separated words, each from the fixed set; an empty value is invalid.
- **integer** (e.g. `aria-colcount`) — must be a whole number.
- **number** (e.g. `aria-valuenow`) — must be a finite number.
- **string** / **id** / **idlist** (e.g. `aria-label`, `aria-activedescendant`) — any literal is accepted; these can't be checked statically.

Two deliberate divergences from the letter of the ARIA spec, both to match the Svelte compiler you build with. The spec lists `undefined` as a value for several boolean attributes, and says a zero-length string should be treated as an absent attribute; the compiler rejects both (`a11y_incorrect_aria_attribute_type_boolean`), and so does this rule. A rule that disagreed with your own build would be noise, not a second opinion.

Attribute and `role` names are matched **case-insensitively**, since HTML lowercases them: `ARIA-LABLE` is reported as `aria-lable`, exactly as the compiler reports it.

Not flagged:

- `aria-hidden="true"` — a valid boolean.
- `aria-live="polite"` — a valid token.
- An expression-valued attribute, since its runtime value is unknown statically: `aria-hidden={isHidden}`.
- An unrecognized attribute name, e.g. `aria-bogus="x"` — owned by `a11y/unknown-aria-attribute`.

## Why it matters

Assistive technology expects each `aria-*` attribute's value to match its spec-defined type. `aria-hidden="yes"` isn't a recognized boolean, and `aria-live="loud"` isn't one of the fixed live-region tokens — both are ignored or misread, so the state or region the author intended to expose never reaches the user, with no visual sign anything is wrong.

## How to fix

Use a value matching the attribute's WAI-ARIA type — `aria-hidden="true"` for a boolean, `aria-live="polite"` for a token:

```svelte
<div aria-hidden="true"></div>
```

## Disabling

If a value is intentionally non-standard, silence a single element with `<!-- svelte-vitals-disable-next-line a11y/invalid-aria-value -->`, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/invalid-aria-value': 'off'
  }
};
```
