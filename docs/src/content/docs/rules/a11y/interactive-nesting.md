---
title: a11y/interactive-nesting · Interactive element nested in an interactive element
description: An interactive element should not sit inside another interactive element.
---

**Severity:** warning · **Category:** a11y

## What it checks

Flags an interactive element (`<button>`, `<input>`, a literal interactive `role`, …) found nested inside another interactive container. Checked from component source, by both the CLI and the Vite plugin — the plugin reads the same `.svelte` files, so the result is identical in either mode. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

Only three kinds of element open a container that this rule watches for a nested descendant:

- `<a href="…">` — an href-less `<a>` is not a container.
- `<button>`.
- An element with a literal role ARIA marks children-presentational, meaning user agents should not expose its descendants through the accessibility API — `button`, `link`, `checkbox`, `radio`, `switch`, `tab`, `menuitemcheckbox`, `menuitemradio`, `option`, `slider`, `scrollbar`. Roles that legitimately contain their own controls are **not** containers: `role="gridcell"` holding a button is the documented grid pattern, and an ARIA 1.1 `role="combobox"` wraps its own `<input>`.

Any interactive element entering while one of those containers is open is flagged, for example:

```svelte
<a href="/x">
  <button>Go</button>
</a>
```

Not flagged:

- A descendant with `tabindex="-1"` — it is removed from the tab order, so it does not compete for keyboard focus.
- A descendant of an href-less `<a>`, since a plain `<a>` with no `href` is not itself interactive.
- Interactive elements nested across components (e.g. a `<button>` inside a child component rendered inside an `<a href>`) — this rule only sees a single component's own template, so that variant is a known non-goal.

## Why it matters

Keyboard and assistive-technology users navigate by control, not by DOM position. A control nested inside another control is announced and operated inconsistently: browsers disagree on which element a click or `Enter` activates, and screen readers differ on how the pair is presented. When the outer element is an `<a href>` or a `<button>`, it is also invalid HTML — their content models forbid interactive descendants outright. A role-based container such as `role="button"` on a `<div>` is not covered by that content-model rule, but its interaction model breaks the same way.

## How to fix

Restructure the markup so each interactive control is a sibling, not a descendant, of another:

```svelte
<div>
  <a href="/x">Go to x</a>
  <button>Extra action</button>
</div>
```

## Disabling

If the nesting is intentional and handled some other way (e.g. `pointer-events` and a synthetic focus trap), silence a single element with `<!-- svelte-vitals-disable-next-line a11y/interactive-nesting -->`, or turn the rule off:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'a11y/interactive-nesting': 'off'
  }
};
```
