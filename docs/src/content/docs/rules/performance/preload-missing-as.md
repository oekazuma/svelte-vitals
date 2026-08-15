---
title: performance/preload-missing-as · Preload missing as
description: Every <link rel="preload"> should declare an as attribute.
---

**Severity:** warning

## What it checks

Every `<link rel="preload">` must have an `as` attribute naming the resource type (`style`, `script`, `font`, `image`, …). A preload without `as` is flagged.

## Why it matters

A `<link rel="preload">` without an `as` attribute is ignored by the browser (or fetched a second time), wasting the preload.

## How to fix

Add an `as` attribute matching the resource type:

```html
<link rel="preload" href="/app.css" as="style" />
```

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'performance/preload-missing-as': 'off'
  }
};
```
