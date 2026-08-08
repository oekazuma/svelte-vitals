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

- **Static (CLI)** walks the route's `.svelte` templates, so it counts headings in branches that may not render (e.g. inside `{#if false}`) and cannot see headings rendered by imported child components.
- **Rendered (vite)** reads the final HTML, so it sees component-rendered headings and only the branches that actually rendered.

When the two disagree, trust the rendered result — it reflects what ships to the browser.
