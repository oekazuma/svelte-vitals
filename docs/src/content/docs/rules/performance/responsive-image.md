---
title: performance/responsive-image · Responsive image
description: Large images should provide a srcset.
---

**Severity:** info

## What it checks

Flags an `<img>` without a `srcset` attribute.

## Why it matters

An `<img>` without `srcset` ships one fixed-size asset to every device, wasting bytes on small screens. Static analysis cannot measure the intended display size, so this is advisory.

## How to fix

Add a `srcset` (and `sizes`) so the browser can pick a right-sized image:

```svelte
<img
  src="/hero.jpg"
  srcset="/hero-800.jpg 800w, /hero-1600.jpg 1600w"
  sizes="100vw"
  width="1600"
  height="900"
  alt="…"
/>
```

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/responsive-image': 'off'
  }
};
```
