---
title: seo/single-h1 · Heading hierarchy
description: Each page should have exactly one <h1>.
---

**Severity:** warning (no `<h1>`) / info (multiple `<h1>`s)

## What it checks

Flags a page with zero `<h1>` (no primary heading, `warning`) or two or more `<h1>` (`info`). Exactly one `<h1>` passes. Headings from the page's layout chain count toward the route, so an `<h1>` in `+layout.svelte` is credited.

A [global severity override](/guides/configuration) (`rules: { 'seo/single-h1': <severity> }`) applies to both arms — it flattens the split to a single severity for every finding this rule produces, since config keys on rule id, not on which arm fired.

## Why it matters

The `<h1>` names a page's main topic. Zero `<h1>` leaves the page without a primary heading — a page genuinely missing this signal, hence `warning`. A single, clear `<h1>` is the conventional signal for a page's topic, but multiple `<h1>`s are tolerated by modern heading algorithms; no official source documents a ranking penalty for having several, so that arm is flagged as a style nit (`info`), not a defect.

## How to fix

```svelte
<!-- +page.svelte -->
<h1>The page's single, descriptive main heading</h1>
<h2>A subsection</h2>
<h2>Another subsection</h2>
```

## Mode differences

Headings are collected in both modes, but from different sources, so results can differ:

- **Static (CLI)** walks the route's `.svelte` templates, so it counts headings in branches that may not render (e.g. inside `{#if false}`) and cannot see headings rendered by imported child components.
- **Rendered (vite)** reads the final HTML, so it sees component-rendered headings and only the branches that actually rendered.

When the two disagree, trust the rendered result — it reflects what ships to the browser.
