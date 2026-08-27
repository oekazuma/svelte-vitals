---
title: seo/duplicate-description · Duplicate description
description: Each route should have a unique meta description.
---

**Severity:** warning

## What it checks

Flags two or more routes whose static `<meta name="description">` content is identical (after trimming and collapsing whitespace). Dynamic or absent descriptions are not checked.

## Why it matters

Duplicate meta descriptions give search engines no per-page summary, so they are often ignored or rewritten.

## How to fix

```svelte
<svelte:head>
  <meta name="description" content="A page-specific summary of this route." />
</svelte:head>
```

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) composes each route's `<head>` from `<svelte:head>` in the page and its layout chain, followed into repo-local components, plus the known meta components (`svelte-meta-tags`, `svelte-seo`) and any you declare in `metaComponents`. It judges only a **literal** value; it never examines a dynamic one. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads the shipped `<head>`, where every value is literal; the build pass covers prerendered routes only. `--route` narrows the comparison to the matched routes; the build pass compares the prerendered routes. The dashboard's live layer leaves this rule to the static baseline, since one page's head has nothing to compare against. When the two disagree, trust the rendered result.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/duplicate-description': 'off'
  }
};
```
