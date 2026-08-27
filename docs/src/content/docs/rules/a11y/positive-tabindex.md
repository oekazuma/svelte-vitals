---
title: a11y/positive-tabindex · Positive tabindex
description: A tabindex above 0 puts the element ahead of every naturally-ordered element on the page, so a single tabindex="1" reorders keyboard navigation globally.
---

**Severity:** warning · **Category:** a11y

## What it checks

Flags an element with a literal `tabindex` attribute whose value parses to a finite number greater than 0:

```svelte
<div tabindex="1">Jumps the tab queue</div>
```

Not flagged:

- `tabindex="0"`, which joins the element to the natural tab order.
- `tabindex="-1"`, which makes the element programmatically focusable only.
- An expression-valued `tabindex={expr}`, whose rendered value is unknowable statically.
- A blank `tabindex`, which is invalid HTML and ignored by browsers.
- A value `Number()` cannot parse, such as `tabindex="1abc"`. Browsers parse a leading integer from it (that element really gets `tabIndex` 1), but the Svelte compiler's own check skips it the same way; see the overlap section below for why the rule follows the compiler.

## Why it matters

Elements with a positive `tabindex` come before every naturally-ordered element on the page, so a single `tabindex="1"` reorders keyboard navigation for the whole document, and the damage compounds: every element added later without a positive `tabindex` sorts after it, no matter where it sits visually. The tab order can then diverge from the visual order, which WCAG 2.4.3 (Focus Order) requires to stay meaningful. The universally-agreed guidance is that only `0` and `-1` are safe values; a positive value is essentially never intentional-and-correct.

## How to fix

Put elements in DOM order and let the natural tab sequence do the work, using `tabindex="0"` only to add a non-interactive element that needs keyboard reach, such as a scrollable region:

```svelte
<div tabindex="0" role="region" aria-label="Release notes" class="scroll-box">…</div>
```

(For anything clickable, use a native `<button>`, which joins the tab order by itself.)

Use `tabindex="-1"` for elements you focus programmatically (e.g. a skip-link target or a dialog):

```svelte
<div tabindex="-1" bind:this={panel}>Focused from code</div>
```

## Limitations

Only literal `tabindex` values on statically named elements are covered, custom elements included, so `<my-widget tabindex="1">` is flagged. An expression-valued `tabindex`, a spread attribute that supplies one, and a dynamic tag via `<svelte:element>` are out of static reach and are not flagged.

## Overlap with the Svelte compiler

The compiler warns on the same markup as `a11y_positive_tabindex`. That overlap is deliberate: the compiler streams into the build log and does not score, gate, or suppress, while this rule feeds the health score, respects `svelte-vitals-disable-next-line`, and fails CI through `--fail-on`.

The two checks share their value parsing (`Number()`-based), and keeping that alignment is why the rule does not implement HTML's leading-integer parsing. Two deliberate divergences remain, and in both this rule sides with the browser: a bare `<div tabindex>` makes the compiler warn while this rule stays silent (browsers give that element `tabIndex` -1), and a non-finite value like `tabindex="Infinity"` or an overflowing number makes the compiler warn while this rule stays silent (browsers ignore the value).

## Mode differences

None. This rule reads source, the same `.svelte` and `.ts` files, everywhere it runs. The CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

If a positive value is genuinely intended, silence a single element with `<!-- svelte-vitals-disable-next-line a11y/positive-tabindex -->`, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/positive-tabindex': 'off'
  }
};
```
