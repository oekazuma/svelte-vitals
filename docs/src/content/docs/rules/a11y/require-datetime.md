---
title: a11y/require-datetime · Missing datetime attribute
description: A time element's text should be machine-readable, or a datetime attribute should supply the machine-readable value.
---

**Severity:** warning · **Category:** a11y

## What it checks

Flags a `<time>` element with no `datetime` attribute whose literal text content is not itself machine-readable. Checked by static (CLI) analysis of every `.svelte` component under `src/`.

Text counts as machine-readable when it matches one of the HTML time-string formats: a year/month/date (`2026-08-14`), a time (`14:30`), a date-time (`2026-08-14T14:30`), a yearless date (`08-14`), a week (`2026-W33`), a time-zone offset (`+09:00`, `Z`), or a duration in either spelling — `P3D` and `4h 18m 3s`. A year may be four **or more** digits.

Not flagged:

- A `datetime` attribute in any form, literal or expression: `<time datetime="2026-08-14">Aug 14</time>`.
- Literal text that is already machine-readable: `<time>2026-08-14</time>`.
- Any content that isn't plain text — an `{expression}`, a component, or a block — since the rendered text can't be resolved statically: `<time>{d}</time>`.

```svelte
<time>last Tuesday</time>
```

## Why it matters

A `<time>` with no `datetime` attribute exposes its text content as the only machine-readable value. Text like "last Tuesday" cannot be parsed by assistive technology, browsers, or search engines into an actual date — the meaning that's obvious to a sighted reader is lost to anything else.

## How to fix

Add a `datetime` attribute with a machine-readable value:

```svelte
<time datetime="2026-08-14">last Tuesday</time>
```

## Disabling

If the text is intentionally not machine-readable, silence a single element with `<!-- svelte-vitals-disable-next-line a11y/require-datetime -->`, or turn the rule off:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'a11y/require-datetime': 'off'
  }
};
```
