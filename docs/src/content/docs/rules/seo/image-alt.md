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

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) reads the `<img>` elements in the route's own templates — the page and its layout chain — not those rendered by a child component. An attribute counts as present when it is written, whatever its value, and a spread (`{...rest}`) counts as present for every attribute. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads every `<img>` in the shipped body; the build pass covers prerendered routes only, and its findings anchor to the HTML file with no source line, so an inline `svelte-vitals-disable-next-line` reaches only the source-analysis finding. When the two disagree, trust the rendered result.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/image-alt': 'off'
  }
};
```
