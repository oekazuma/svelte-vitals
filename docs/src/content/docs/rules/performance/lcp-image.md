---
title: performance/lcp-image · LCP image eager loading
description: The first (likely LCP) image should not be lazy-loaded.
---

**Severity:** warning

## What it checks

Flags the first `<img>` in a route's markup when it has `loading="lazy"`. Static analysis approximates the Largest Contentful Paint image as the first image in document order.

## Why it matters

Lazy-loading the LCP / above-the-fold image delays the largest paint and hurts Core Web Vitals. The first image is the best static proxy for the LCP candidate, so it should load eagerly.

## How to fix

Remove `loading="lazy"` from the first/LCP image and consider `fetchpriority="high"`:

```svelte
<img src="/hero.jpg" width="1200" height="630" fetchpriority="high" alt="…" />
```

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) reads the `<img>` elements in the route's own templates, meaning the page and its layout chain, not those rendered by a child component. `loading="lazy"` is judged from the literal attribute only; a dynamic `loading={…}` or a spread (`{...rest}`) is never flagged. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads every `<img>` in the shipped body; the build pass covers prerendered routes only, and its findings anchor to the HTML file with no source line, so an inline `svelte-vitals-disable-next-line` reaches only the source-analysis finding. When the two disagree, trust the rendered result.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/lcp-image': 'off'
  }
};
```
