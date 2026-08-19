---
title: performance/preload-missing-as · Preload missing as
description: Every <link rel="preload"> should declare an as attribute.
---

**Severity:** warning

## What it checks

Every `<link rel="preload">` must have an `as` attribute naming the resource type (`style`, `script`, `font`, `image`, …). A preload without `as` is flagged.

## Why it matters

A `<link rel="preload">` without an `as` attribute is ignored by the browser (or fetched a second time), wasting the preload.

## How to fix

Add an `as` attribute matching the resource type:

```html
<link rel="preload" href="/app.css" as="style" />
```

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) composes each route's `<head>` from `<svelte:head>` in the page and its layout chain, followed into repo-local components, plus the known meta components (`svelte-meta-tags`, `svelte-seo`) and any you declare in `metaComponents`, and judges only a **literal** value — a dynamic one is not examined. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads the shipped `<head>`, where every value is literal; the build pass covers prerendered routes only. When the two disagree, trust the rendered result.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/preload-missing-as': 'off'
  }
};
```
