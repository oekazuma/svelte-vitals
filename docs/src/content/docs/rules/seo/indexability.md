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

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'seo/indexability': 'off'
  }
};
```
