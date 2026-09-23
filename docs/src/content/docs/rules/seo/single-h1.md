---
title: seo/single-h1 · Heading hierarchy
description: Each page should have exactly one <h1>.
---

**Severity:** warning (no `<h1>`) / info (multiple `<h1>`s)

## What it checks

Flags a page with zero `<h1>` (no primary heading, `warning`) or two or more `<h1>` (`info`). Exactly one `<h1>` passes. Headings from the page's layout chain count toward the route, so an `<h1>` in `+layout.svelte` is credited.

A [global severity override](/guides/configuration) (`rules: { 'seo/single-h1': <severity> }`) applies to both arms. It flattens the split to a single severity for every finding this rule produces, since config keys on rule id, not on which arm fired.

## Why it matters

The `<h1>` names a page's main topic. Zero `<h1>` leaves the page without a primary heading, a page genuinely missing this signal, hence `warning`. A single, clear `<h1>` is the conventional signal for a page's topic, but multiple `<h1>`s are tolerated by modern heading algorithms; no official source documents a ranking penalty for having several, so that arm is flagged as a style nit (`info`), not a defect.

## How to fix

```svelte +page.svelte
<h1>The page's single, descriptive main heading</h1>

<h2>A subsection</h2>
<h2>Another subsection</h2>
```

## Mode differences

Headings are collected in both modes, but from different sources, so results can differ:

- **Source analysis** (the CLI, the dashboard's static baseline) walks the route's `.svelte` templates, including headings rendered by imported local components (followed transitively, depth-limited, the same traversal used for head resolution), so extracting a page's `<h1>` into a `$lib` component is credited. It still counts headings in branches that may not render (e.g. inside `{#if false}`), and it cannot see components from `node_modules`, dynamically chosen components, or which conditional branch actually renders. A heading inside an unresolvable component can still produce a false "Missing `<h1>`", and multiple conditionally-rendered headings can produce an `info`-level over-count.
  A `<svelte:element this={…}>` counts as the element it resolves to when the tag expression is a string literal, or a conditional whose branches are both literals and name one heading level (`this={featured ? 'h1' : 'span'}`). When the tag is not determinable that way — ``this={`h${level}`}``, a variable, or a conditional between two different heading levels — the element may be the page's `<h1>`, so the route is left unreported rather than flagged as missing one.
  The same applies to a component it cannot follow (from `node_modules`, for instance) that is given an attribute whose value is a literal `h1`–`h6` (`<Heading tag="h1">`): the component may render that heading, so the route is left unreported.
- **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads the rendered HTML, so it sees every component-rendered heading and only the branches that actually rendered.

When the two disagree, trust the rendered result (`@svelte-vitals/vite`). It reflects what ships to the browser.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/single-h1': 'off'
  }
};
```
