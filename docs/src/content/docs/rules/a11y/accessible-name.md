---
title: a11y/accessible-name · Interactive element has no accessible name
description: A button, link, or image button needs a way to compute its accessible name.
---

**Severity:** warning · **Category:** a11y

## What it checks

Flags a `<button>`, `<a href="…">`, or `<input type="image">` with no computable accessible name. Checked by static (CLI) analysis of every `.svelte` component under `src/`.

Any of the following, if present, is a name source — the element is not flagged:

- A non-whitespace text descendant, e.g. `<button>Save</button>`.
- An `aria-label`, `aria-labelledby`, or `title` attribute — a literal non-empty value, or any expression (its rendered value is unknowable, but the attribute's presence is enough).
- A descendant `<img>` with a non-empty literal `alt`.
- For `<input type="image">`, its own non-empty literal `alt`.

Not flagged, even with no name source found:

- An element whose content is unknowable — any `{expression}` child, a component child, `{@render …}`, `{@html …}`, a `<slot>` or `<svelte:fragment>` (its content comes from the parent), a hyphenated custom element (its shadow root may supply content), or a spread attribute on the element itself.
- A `<button>` or `<input type="image">` a `<label>` names — either by wrapping it, or by pointing at its `id` with `for`. That label step comes ahead of the element's own subtree in the name computation. `<a>` has no such step, so links are checked on their content alone. The `for` route is same-file only: a label in another component is a known limitation.

The rule only flags what it can prove is unnamed; it never guesses at dynamic content.

```svelte
<button></button>
<a href="/x"><img src="i.png" /></a>
```

## Why it matters

Assistive technology announces an interactive control by its accessible name. With none, a screen reader falls back to the bare role — "button", "link" — indistinguishable from every other unnamed control on the page. A sighted user relying on an icon alone has no such gap, which is why the problem hides in visual review.

## How to fix

Give the element visible text, a labelling attribute, or an `alt` on its icon image:

```svelte
<button aria-label="Save">💾</button>
<a href="/x"><img src="i.png" alt="Home" /></a>
<input type="image" src="search.png" alt="Search" />
```

## Disabling

If the name is supplied some other way this rule can't see (e.g. a wrapping label element), silence a single element with `<!-- svelte-vitals-disable-next-line a11y/accessible-name -->`, or turn the rule off:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'a11y/accessible-name': 'off'
  }
};
```
