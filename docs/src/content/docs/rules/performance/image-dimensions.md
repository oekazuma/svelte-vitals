---
title: performance/image-dimensions · Image dimensions
description: Every <img> should have explicit width and height attributes.
---

**Severity:** warning

## What it checks

Every `<img>` element must have explicit `width` and `height` attributes set. Images missing either attribute are flagged.

## Why it matters

An `<img>` without explicit width and height can trigger layout shift (CLS) as it loads, hurting Core Web Vitals and visual stability — unless the box is reserved another way, e.g. CSS `aspect-ratio`.

## How to fix

Add explicit `width` and `height` attributes to the `<img>`:

```svelte
<img src="/hero.jpg" width="1200" height="630" alt="…" />
```

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'performance/image-dimensions': 'off'
  }
};
```
