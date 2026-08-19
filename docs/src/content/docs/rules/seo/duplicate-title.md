---
title: seo/duplicate-title · Duplicate title
description: Each route should have a unique <title>.
---

**Severity:** warning

## What it checks

Flags two or more routes whose static `<title>` text is identical (after trimming and collapsing whitespace). Routes whose title is dynamic or absent are not checked.

## Why it matters

Duplicate titles across pages make them compete in search results and weaken each page's relevance signal.

## How to fix

```svelte
<svelte:head>
  <title>About our team — Acme</title>
</svelte:head>
```

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) composes each route's `<head>` from `<svelte:head>` in the page and its layout chain, followed into repo-local components, plus the known meta components (`svelte-meta-tags`, `svelte-seo`) and any you declare in `metaComponents`, and judges only a **literal** value — a dynamic one is not examined. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads the shipped `<head>`, where every value is literal; the build pass covers prerendered routes only. `--route` narrows the comparison to the matched routes; the build pass compares the prerendered routes. The dashboard's live layer leaves this rule to the static baseline — one page's head has nothing to compare against. When the two disagree, trust the rendered result.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/duplicate-title': 'off'
  }
};
```
