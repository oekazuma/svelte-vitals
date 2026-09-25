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

- **Source analysis** (the CLI, the dashboard's static baseline) walks the route's `.svelte` templates, including headings rendered by imported local components (followed transitively, depth-limited, the same traversal used for head resolution), so extracting a page's `<h1>` into a `$lib` component is credited. Components re-exported through a barrel `index.ts`, namespace members (`<Ui.Title>`) and a `const`/`$derived`/`{@const}` holding an imported component, or a `let` a function fills with `import()`, are followed; when it holds one of several, an `<h1>` in any of them keeps the route from being reported as missing one. A component loaded with `import()` renders only in the browser, so its `<h1>` does this only on a route with `ssr = false`. The arms of one `{#if}`/`{:else if}`/`{:else}` or `{#await}` block never render together, and neither do a `<svelte:boundary>`'s content and its `failed`/`pending` snippets, so only the arm with the most `<h1>`s counts. An arm includes the components placed in it, and the page renders inside the arm of its layout's `<slot />`/`{@render children()}`. Content passed to a component (its children, or a `{#snippet}` in its tag) sits in the arm where that component renders it, so a wrapper that puts `{@render children()}` and an error screen in one `<svelte:boundary>` or `{#if}` does not add its error `<h1>` to the page it wraps; content passed to a component that cannot be followed stays where it is written. A snippet the file renders counts at each `{@render}` of it, in that `{@render}`'s arm. Separate blocks still add up, because both conditions may hold. It still counts headings in branches that may not render (e.g. inside `{#if false}`, or behind a prop the component is never given), and it cannot see components from npm packages in `node_modules` (a workspace package the app declares is followed, see [Configuration](/guides/configuration)) or a component picked from data or a lookup table at runtime. A heading inside an unresolvable component can still produce a false "Missing `<h1>`", and `<h1>`s in separate conditional blocks can produce an `info`-level over-count.
  A `<svelte:element this={…}>` counts as the element it resolves to when the tag expression is a string literal, or a conditional whose branches are both literals and name one heading level (`this={featured ? 'h1' : 'span'}`). When the tag is not determinable that way — ``this={`h${level}`}``, a variable, or a conditional between two different heading levels — the element may be the page's `<h1>`, so the route is left unreported rather than flagged as missing one.
  The same applies to a component it cannot follow (from `node_modules`, for instance) that is given `tag`, `as`, `element` or `is` with the literal value `h1` (`<Heading tag="h1">`): the component may render the page's `<h1>`, so the route is left unreported. Other props (`value="h1"`) and other levels (`tag="h3"`) say nothing about the `<h1>` and do not.
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
