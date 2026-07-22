---
title: performance/image-loading-hint · Image loading hint
description: Every <img> should have an explicit loading attribute.
---

**Severity:** info

## What it checks

Every `<img>` element must have an explicit `loading` attribute. Images missing the `loading` attribute are flagged.

## Why it matters

A `loading` attribute lets the browser defer offscreen images; without it images load eagerly and can delay more important content. Static analysis cannot tell which image is the LCP, so this is advisory.

## How to fix

Add `loading="lazy"` to offscreen `<img>` elements (leave the LCP/hero image eager):

```svelte
<img src="/thumb.jpg" width="320" height="240" loading="lazy" alt="…" />
```
