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

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) reads the `<img>` elements in the route's own templates — the page and its layout chain — not those rendered by a child component. An attribute counts as present when it is written, whatever its value, and a spread (`{...rest}`) counts as present for every attribute. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads every `<img>` in the shipped body; the build pass covers prerendered routes only, and its findings anchor to the HTML file with no source line, so an inline `svelte-vitals-disable-next-line` reaches only the source-analysis finding. When the two disagree, trust the rendered result.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/image-loading-hint': 'off'
  }
};
```
