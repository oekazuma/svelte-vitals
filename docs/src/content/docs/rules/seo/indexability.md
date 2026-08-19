---
title: seo/indexability · Indexability
description: A route should not be accidentally set to noindex.
---

**Severity:** info

## What it checks

If a route's `<meta name="robots">` statically resolves to `noindex` (or `none`), it is surfaced so you can confirm the de-indexing is intentional. A dynamically-set robots value is not flagged.

## Why it matters

A noindex directive removes the page from search results; an accidental noindex on a public route silently deindexes it — one of the most damaging SEO mistakes.

## How to fix

If this route should be indexed, remove `noindex` from its robots meta:

```svelte
<svelte:head>
  <meta name="robots" content="index, follow" />
</svelte:head>
```

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) composes each route's `<head>` from `<svelte:head>` in the page and its layout chain, followed into repo-local components, plus the known meta components (`svelte-meta-tags`, `svelte-seo`) and any you declare in `metaComponents`, and judges only a **literal** value — a dynamic one is not examined. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads the shipped `<head>`, where every value is literal; the build pass covers prerendered routes only. When the two disagree, trust the rendered result.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/indexability': 'off'
  }
};
```
