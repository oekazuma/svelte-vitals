---
title: a11y/no-autofocus · Autofocus outside a dialog
description: autofocus moves focus on page load without the user asking — screen reader users lose the page context they were building, and keyboard users are dropped mid-page.
---

**Severity:** warning · **Category:** a11y

## What it checks

Flags an element with a literal `autofocus` attribute — bare or string-valued — unless the element is a `<dialog>`, or sits inside a `<dialog>` or a popover container in the same component template:

```svelte
<input autofocus placeholder="Search" />
```

Not flagged:

- An expression-valued `autofocus={expr}` — the expression could be `false`, so the rendered attribute is unknowable statically.
- `autofocus` on a `<dialog>` element or on any descendant of one — the dialog focusing steps run when the dialog is shown, not at page load, and honour an `autofocus` descendant. This is the attribute's correct use.
- A descendant of an element carrying the `popover` attribute, in any form (bare, literal, or expression) — the popover focusing steps behave like the dialog's, and an expression could resolve to a real popover value, so the carve-out stays generous rather than flag the documented pattern.
- An `autofocus` supplied through a spread attribute — out of static reach.

## Why it matters

`autofocus` moves focus when the page loads, without the user asking, skipping everything before the target. Screen reader users lose the page context they were building — the title, headings, and landmarks they would have heard first — and keyboard users are dropped mid-page with no idea what came before. Inside a `<dialog>` or a popover the semantics are different: focus moves when the container is shown, which is exactly what WAI-ARIA dialog patterns require. Anywhere else it is almost always a usability bug.

## How to fix

Remove the attribute and let focus start at the top of the page:

```svelte
<input placeholder="Search" />
```

If the control belongs to a dialog or popover, move it inside that container and keep `autofocus` — that is the supported pattern. Focus moved in response to a user action belongs in an event handler instead.

## Limitations

The dialog/popover carve-out only sees ancestors in the same component template, and the ancestor chain breaks at every construct whose rendering position is not lexical: a component boundary, a `{#snippet}` body, `<svelte:element>`, a custom element or unknown tag, `{@html}`, `{@render}`, and `<slot>`. Past a break the dialog cannot be proven, so an `autofocus` inside a component that its parent renders into a `<dialog>` is a known false positive — silence it with `<!-- svelte-vitals-disable-next-line a11y/no-autofocus -->` on the element.

## Overlap with the Svelte compiler

The compiler warns on similar markup as `a11y_autofocus`, with the same `<dialog>` carve-out. That overlap is deliberate: the compiler streams into the build log and does not score, gate, or suppress — this rule feeds the health score, respects `svelte-vitals-disable-next-line`, and fails CI through `--fail-on`.

Four deliberate divergences remain:

- An expression-valued `autofocus={expr}` makes the compiler warn while this rule stays silent — the expression could be `false`.
- A deep descendant of `<dialog>` (e.g. `<dialog><div><input autofocus /></div></dialog>`) makes the compiler warn — it only checks the nearest element ancestor — while this rule walks the whole chain and correctly passes it.
- An ancestor reached through `<svelte:element>` makes the compiler stay silent, while this rule reports on the broken chain: opposite defaults when containment is unknowable.
- A popover container exempts the attribute for this rule but not for the compiler.

## Mode differences

None. This rule reads source — the same `.svelte` and `.ts` files — on every surface: the CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

If a page-load `autofocus` is genuinely intended (a dedicated search page, a login form), silence a single element with `<!-- svelte-vitals-disable-next-line a11y/no-autofocus -->`, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/no-autofocus': 'off'
  }
};
```
