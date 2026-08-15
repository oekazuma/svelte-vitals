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

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'seo/og-image': 'off'
  }
};
```
