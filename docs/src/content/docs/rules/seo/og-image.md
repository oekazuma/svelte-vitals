---
title: seo/og-image · Open Graph image
description: Every route should include a <meta property="og:image"> tag.
---

**Severity:** warning

## What it checks

Every route must include a `<meta property="og:image">` tag (own or inherited through the layout chain). A missing or empty Open Graph image meta tag is flagged.

## Why it matters

`og:image` is the preview thumbnail shown when the page is shared on social platforms; without it links render bare and get fewer clicks.

## How to fix

Add `<meta property="og:image">`, or set `openGraph.images` on your meta component:

```svelte
<svelte:head>
  <meta property="og:image" content="https://example.com/og.png" />
</svelte:head>
```

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) composes each route's `<head>` from `<svelte:head>` in the page and its layout chain, followed into repo-local components, plus the known meta components (`svelte-meta-tags`, `svelte-seo`) and any you declare in `metaComponents`. A value it cannot read literally (`{data.title}`) is `dynamic`, judged by `treatDynamicAs`. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads the shipped `<head>`, where every value is literal and `treatDynamicAs` does not apply; the build pass covers prerendered routes only. When the two disagree, trust the rendered result.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/og-image': 'off'
  }
};
```
