---
title: seo/image-alt · Image alt text
description: Every <img> should have an alt attribute.
---

**Severity:** warning

## What it checks

Flags an `<img>` with no `alt` attribute. An explicit empty `alt=""` is a valid signal for purely decorative images and passes. A spread (`{...rest}`) may supply `alt`, so it is not flagged.

## Why it matters

An `<img>` with no `alt` attribute is invisible to image search and assistive technology. A descriptive `alt` is an image-SEO signal and improves accessibility.

## How to fix

```svelte
<img src="/photo.jpg" width="800" height="600" alt="Golden retriever catching a frisbee in a park" />

<!-- Purely decorative image: -->
<img src="/divider.svg" alt="" />
```

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'seo/image-alt': 'off'
  }
};
```
