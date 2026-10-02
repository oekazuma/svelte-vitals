---
title: seo/heading-level-skip · Heading order
description: Heading levels should not be skipped.
---

**Severity:** info

## What it checks

Flags a heading whose level jumps more than one step over the previous heading (for example `<h2>` directly followed by `<h4>`). Presence of a single `<h1>` is covered by `seo/single-h1`.

## Why it matters

Skipping a heading level breaks the document outline that assistive technology relies on to navigate page structure, and that search engines use as a structural signal.

## How to fix

```svelte
<h1>Page title</h1><h2>Section</h2><h3>Subsection</h3>
```

## Mode differences

Headings are collected in both modes, but from different sources, so results can differ:

- **Source analysis** (the CLI, the dashboard's static baseline) walks the route's `.svelte` templates, so it counts headings in branches that may not render (e.g. inside `{#if false}`). Headings are read in document order: the page where its layout renders `<slot />`/`{@render children()}`, a snippet's heading at its `{@render}`, and a heading an imported child component renders (followed as for [seo/single-h1](/rules/seo/single-h1)) at the component's tag. A component's heading counts only as the heading before one of the route's own files, and only where it renders whenever that heading does (so a heading in a closed dialog or menu, or in a component placed behind an `{#if}` of its own, closes no gap); a skip at a component's heading is not reported, so shared layout chrome cannot stand in for every page's own finding. An `{#each}` body is read as possibly empty. When the heading before sits in one arm of a block, each arm is a rendering: the last heading of every arm is compared, and the lowest level counts — unless that heading repeats in an `{#each}` the flagged one is outside, where the last pass's arm depends on the data and only the nearest heading counts. A `<svelte:element>` whose level the source does not determine (`this={`h${level}`}`, or a tag prop) holds its place without a level, and the heading after it is not judged. An element with `role="heading"` is a heading of its `aria-level` (2 without one); one whose `aria-level` is an expression holds its place without a level in the same way. Each arm of one `{#if}`/`{:else if}`/`{:else}` or `{#await}` block is read on its own, as are a `<svelte:boundary>`'s content and its `failed`/`pending` snippets: a heading is compared with the nearest earlier heading that can render alongside it, never with one from a sibling arm. The page is read inside the arm of its layout's `<slot />`/`{@render children()}`, and content passed to a component inside the arm where that component renders it. A layout that renders them in several arms of one `{#if}` places the page in each of those arms; places in separate blocks leave it where they all agree. An arm whose test reads `page.url.pathname` (or `$page.url.pathname`, directly or through a `$derived`) with `startsWith`, `endsWith`, `includes`or`===`against a string literal is left out on a route whose path cannot satisfy it. The same reading decides any `{#if}` in a layout or page by the route, and its test may also be `page.route.id` (or `$page.route.id`) against a string literal or in an array literal (`['/a', '/b'].includes(page.route.id)`), a regex literal's `.test()` of the path, or the path's `===` against a template literal (`` `/c/${slug}` ``, each `${…}` taken as the route parameter in its place). An arm whose test is an imported binding (`{#if FLAG}`, `{#if !FLAG}`) that one of the app's own modules exports as the literal `false` is left out too; when that leaves no place the layout renders its children, the page and the layouts below it are not counted on that route. A heading whose own conditions leave only one arm of an earlier block with an `{:else}` renders with that arm (after `{#if !rule}…{:else}<h2>…{/if}`, a heading in `{#if open && rule}` follows that `<h2>`). Separate blocks are treated as all rendering, except`{#if}`blocks without an`{:else}`in one arm (no other block,`{#each}` or component between them; elements may be) whose conditions contradict each other on one value (`{#if pitch}`and`{#if !pitch}`), which are read as arms of one block.
- **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads the rendered HTML, so it sees component-rendered headings and only the branches that actually rendered.

When the two disagree, trust the rendered result. It reflects what ships to the browser.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/heading-level-skip': 'off'
  }
};
```
