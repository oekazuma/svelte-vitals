---
title: a11y/aria-hidden-focus · Focusable element hidden by aria-hidden
description: A keyboard-focusable element must not be hidden from assistive technology with aria-hidden="true".
---

**Severity:** warning · **Category:** a11y

## What it checks

Flags a keyboard-focusable element that a literal `aria-hidden="true"` hides from assistive technology — whether the attribute sits on the element itself or on an ancestor:

```svelte
<div aria-hidden="true">
  <button>Hidden but focusable</button>
</div>

<a href="/x" aria-hidden="true">Also flagged</a>
```

Focusable means the same element set as `a11y/interactive-nesting`'s descendants: `<button>`, `<a href>`, form controls, `<audio controls>`/`<video controls>`, a literal `tabindex` ≥ 0, or a literal interactive ARIA role.

Not flagged:

- An expression-valued `aria-hidden` (`aria-hidden={!open}`). A toggled value is unknowable statically, so the legitimate open/close pattern — hide while closed, unhide while open — never triggers this rule. An expression `tabindex` is unknowable the same way (it may resolve to `-1`) and exempts the element.
- An element removed from the tab order with a literal negative `tabindex`. `<button tabindex="-1" aria-hidden="true">` is the documented remediation, hidden from both the accessibility tree and keyboard focus.
- A `disabled` form control (`<button>`, `<input>`, `<select>`, `<textarea>`) — disabling removes it from the tab order too.
- Anything at or under an element with the `inert` attribute: the whole subtree is unfocusable, so an `aria-hidden` + `inert` combination is consistent, not a defect.
- `aria-hidden="false"`, and `aria-hidden="true"` subtrees containing nothing focusable (a decorative `<svg aria-hidden="true">` icon stays clean).
- The valueless shorthand `<div aria-hidden>`: Svelte renders it as `aria-hidden=""`, an invalid value assistive technology treats as unset, and this rule matches only the literal `"true"`. Also `<svelte:element>`, whose tag is out of static reach — a known non-goal, same as the other element rules.
- A focusable element inside a child component rendered within an `aria-hidden` container. This rule only sees a single component's own template, so that variant is a known non-goal.

## Why it matters

An element inside `aria-hidden="true"` stays keyboard-reachable while assistive technology announces nothing for it: a screen reader user tabs onto a control that, for them, does not exist. And the author cannot see this defect — `aria-hidden` changes nothing visually, so the page looks and clicks exactly the same to a sighted developer. The bug only ever surfaces for assistive-technology users, which is why WAI-ARIA forbids hiding focusable content this way.

## How to fix

Remove `aria-hidden`, or take the element out of the tab order too:

```svelte
<div aria-hidden="true">
  <button tabindex="-1">Consistently hidden</button>
</div>
```

To hide an inactive region — a modal backdrop, an off-screen panel — prefer the `inert` attribute, which removes the subtree from the accessibility tree and the tab order at once:

```svelte
<div inert={dialogOpen}>
  <button>Backdrop content</button>
</div>
```

## Mode differences

None. This rule reads source, the same `.svelte` and `.ts` files, everywhere it runs. The CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

If the element is genuinely unreachable some other way (e.g. focus is managed by script), silence a single element with `<!-- svelte-vitals-disable-next-line a11y/aria-hidden-focus -->`, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/aria-hidden-focus': 'off'
  }
};
```
