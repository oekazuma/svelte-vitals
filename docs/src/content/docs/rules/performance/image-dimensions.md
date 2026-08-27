---
title: performance/image-dimensions · Image dimensions
description: Every <img> should have explicit width and height attributes.
---

**Severity:** warning

## What it checks

Every `<img>` element must have explicit `width` and `height` attributes set. Images missing either attribute are flagged.

## Why it matters

An `<img>` without explicit width and height can trigger layout shift (CLS) as it loads, hurting Core Web Vitals and visual stability, unless the box is reserved another way, for example with CSS `aspect-ratio`.

## How to fix

Add explicit `width` and `height` attributes to the `<img>`:

```svelte
<img src="/hero.jpg" width="1200" height="630" alt="…" />
```

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) reads the `<img>` elements in the route's own templates, meaning the page and its layout chain, not those rendered by a child component. An attribute counts as present when it is written, whatever its value, and a spread (`{...rest}`) counts as present for every attribute. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads every `<img>` in the shipped body; the build pass covers prerendered routes only, and its findings anchor to the HTML file with no source line, so an inline `svelte-vitals-disable-next-line` reaches only the source-analysis finding. When the two disagree, trust the rendered result.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/image-dimensions': 'off'
  }
};
```
