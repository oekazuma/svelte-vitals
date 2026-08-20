---
title: a11y/permitted-contents · Permitted contents
description: Every element must be permitted content of its parent, per the HTML content models.
---

**Severity:** warning (broken structure) / info (category mismatches) — see below

## What it checks

Every literal child element must be a member of its literal parent's permitted-content set, per
the HTML content models (the same vendored spec data as the other element rules). Membership
only — never order or count, which components and `{#if}`/`{#each}` blocks make unjudgeable — and
a child inside a control-flow block still counts as the enclosing element's child. Transparent
elements (`<a>`, `<ins>`, `<del>`, …) pass the question up: `<ul><a href="…"><strong>` judges the
`<strong>` against `<ul>`'s model. The `dl > div` styling wrapper and every other conditional
model the spec defines is honoured.

Two severities, split by consequence:

- **warning** — the violation breaks structure assistive tech relies on: the parent admits only
  specific elements (`<ul>`, `<ol>`, `<table>`, `<select>`, `<hgroup>`, …), a heading crosses the
  boundary in either direction (`<button><h5>`, `<h2><div>`), or the child is a structure-bound
  tag outside its container (`<div><li>`).
- **info** — a category mismatch (`<button><div>`, `<label><div>`): spec-invalid, but browsers
  render it and the practical impact is small.

Not reported, on purpose:

- `<option>`/`<optgroup>` children — the Svelte compiler deliberately allows rich `<option>`
  content, and where the compiler and the spec data disagree, the compiler wins.
- Interactive nesting (`<a href><button>`, a `<button>` anywhere inside a link) —
  [`a11y/interactive-nesting`](/rules/a11y/interactive-nesting) owns that verdict; this rule
  reports the content-model half only, so one defect is never two findings.
- Anything across a boundary the static walk cannot see through: a component tag,
  `<svelte:element>`, `<slot />`, `{@render}`, `{@html}`. A `{#snippet}` body is judged on its
  own, not against the element that happens to enclose the declaration.
- Custom elements (a tag with a dash), unknown tags, SVG subtrees, and text children.

## Why it matters

An element outside its parent's permitted content is markup assistive technology mis-announces:
a `<ul>` whose children are `<div>`s is announced as a list with no list items, a `<li>` outside
any list loses its meaning, and a heading inside a `<button>` loses or pollutes its outline role.
The Svelte compiler errors only on the subset browsers would repair (`<p><div>` written directly);
everything this rule reports compiles silently.

## How to fix

Move the child into an element the parent permits, or change the container:

```svelte
<!-- before -->
<ul>
  <div>Item one</div>
</ul>

<!-- after -->
<ul>
  <li>Item one</li>
</ul>
```

For a `<button>` needing block layout, style a `<span>` (`display: block` is fine on phrasing
content) instead of nesting a `<div>`.

## Mode differences

None. This rule reads source — the same `.svelte` and `.ts` files — on every surface: the CLI,
the Vite plugin's build pass, and the live dashboard's static baseline all report it identically,
and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it:
component-scoped rules have no route to attribute a finding to.

## Disabling

An inline `svelte-vitals-disable-next-line` comment above the child silences one finding. Record
existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the
rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/permitted-contents': 'off'
  }
};
```
