---
title: performance/font-preload-crossorigin · Font preload missing crossorigin
description: A font preload must set crossorigin so the preloaded file is actually used.
---

**Severity:** warning

## What it checks

Every `<link rel="preload" as="font">` must include the `crossorigin` attribute. A font preload without it is flagged.

## Why it matters

A font preload without `crossorigin` does not match the actual (CORS) font request, so the preloaded file is never used and the font downloads twice.

## How to fix

Add `crossorigin` to the font preload:

```html
<link rel="preload" href="/inter.woff2" as="font" type="font/woff2" crossorigin />
```

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/font-preload-crossorigin': 'off'
  }
};
```
