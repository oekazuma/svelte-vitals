---
title: a11y/no-duplicate-dt · Duplicate <dt> names in a <dl>
description: Within a single dl element there should not be more than one dt element for each name; a duplicated term usually means two descriptions were meant to share one dt.
---

**Severity:** info · **Category:** a11y

## What it checks

Flags a `<dt>` whose text duplicates an earlier `<dt>` in the same `<dl>`:

```svelte
<dl>
  <dt>Coffee</dt>
  <dd>Hot, brewed</dd>
  <dt>Coffee</dt>
  <dd>Iced, cold brew</dd>
</dl>
```

A term's name is its static text content, and static phrasing markup is looked through, so `<dt><code>HTTP</code></dt>` and `<dt>HTTP</dt>` carry the same name, and comments contribute nothing. Names are compared after trimming and collapsing internal whitespace, case-sensitively (the spec leaves the equality unstated, so only certain duplicates are reported). The div-wrapped name-value-group form counts too: a `<dt>` that is a direct child of a `<div>` directly inside the `<dl>` participates. Each `<dl>` is its own scope. The same term in two different lists is fine, and a `<dl>` nested inside a `<dd>` is judged on its own.

Not flagged:

- A `<dt>` with any dynamic content. An `{expression}`, component, block, or custom-element child anywhere below makes the name unknowable.
- A `<dt>` under a logic block (`{#if}`, `{#each}`, …) or inside a component, whose multiplicity or rendered content is unknowable.
- Empty or whitespace-only `<dt>`s. Two blank terms are a missing-content defect, not a duplicate name.
- A `<dl>` inside `<svg>`, which never renders as an HTML description list.

## Why it matters

The HTML spec states that within a single `dl` element, there should not be more than one `dt` element for each name. In practice a duplicated term is almost always a copy-paste error: two descriptions were meant to share one term, since a single `<dt>` may be followed by several `<dd>` elements.

## How to fix

Merge the descriptions under one `<dt>`:

```svelte
<dl>
  <dt>Coffee</dt>
  <dd>Hot, brewed</dd>
  <dd>Iced, cold brew</dd>
</dl>
```

Or rename one of the terms if the entries are genuinely different.

## Mode differences

None. This rule reads source, the same `.svelte` and `.ts` files, everywhere it runs. The CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

If the duplicate is intended, silence the element with `<!-- svelte-vitals-disable-next-line a11y/no-duplicate-dt -->`, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/no-duplicate-dt': 'off'
  }
};
```
