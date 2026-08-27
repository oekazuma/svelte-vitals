---
title: a11y/require-datetime · Missing datetime attribute
description: A time element's text should be machine-readable, or a datetime attribute should supply the machine-readable value.
---

**Severity:** info · **Category:** a11y

Scored `info` rather than `warning`: the requirement is HTML conformance, not an accessibility criterion. A screen reader reads "last Tuesday" exactly as a sighted reader does. What the element loses is its machine-readable value.

## What it checks

Flags a `<time>` element with no `datetime` attribute whose literal text content is not itself machine-readable.

Text counts as machine-readable when it matches one of the HTML time-string formats: a year/month/date (`2026-08-14`), a time (`14:30`), a date-time (`2026-08-14T14:30`), a yearless date (`08-14`), a week (`2026-W33`), a time-zone offset (`+09:00`, `Z`), or a duration in either spelling, `P3D` and `4h 18m 3s`. A year may be four **or more** digits.

Not flagged:

- A `datetime` attribute in any form, literal or expression: `<time datetime="2026-08-14">Aug 14</time>`.
- Literal text that is already machine-readable: `<time>2026-08-14</time>`.
- Any content that isn't plain text, whether an `{expression}`, a component, or a block, since the rendered text can't be resolved statically: `<time>{d}</time>`.
- A spread attribute on the `<time>`, which may itself supply `datetime`, so the element is skipped: `<time {...props}>last Tuesday</time>`.

```svelte
<time>last Tuesday</time>
```

## Why it matters

A `<time>` with no `datetime` attribute exposes its text content as the only machine-readable value, and the HTML spec requires that text to be a valid date/time string. Text like "last Tuesday" reads fine to everyone, and a screen reader announces it exactly as a sighted reader sees it, but it is not a valid date/time string, so the element exposes no standardized date. A consumer that wants one is left guessing at the prose. The loss is to machines, not to readers, which is why this rule is about the element's semantics rather than about what a screen reader says.

## How to fix

Add a `datetime` attribute with a machine-readable value:

```svelte
<time datetime="2026-08-14">last Tuesday</time>
```

## Mode differences

None. This rule reads source, the same `.svelte` and `.ts` files, everywhere it runs. The CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

If the text is intentionally not machine-readable, silence a single element with `<!-- svelte-vitals-disable-next-line a11y/require-datetime -->`, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/require-datetime': 'off'
  }
};
```
