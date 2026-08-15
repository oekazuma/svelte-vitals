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

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'seo/duplicate-description': 'off'
  }
};
```
