---
title: performance/responsive-image · Responsive image
description: Large images should provide a srcset.
---

**Severity:** info

## What it checks

Flags an `<img>` without a `srcset` attribute. This rule runs in static (CLI) analysis only.

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
