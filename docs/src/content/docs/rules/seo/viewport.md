---
title: seo/viewport · Viewport
description: Pages should declare a responsive viewport meta tag.
---

**Severity:** warning

## What it checks

Every route should expose a `<meta name="viewport">` tag (usually set once in `app.html`). A missing tag is flagged. Because the viewport tag normally lives in `app.html` — which static (CLI) mode does not resolve — this rule is evaluated in plugin/rendered mode only.

## Why it matters

Without a viewport meta tag, mobile browsers render the page at a fixed ~980px layout viewport and scale it to fit, so text and controls end up too small to read or tap without pinch-zooming.

## How to fix

Add the viewport meta tag, typically in `src/app.html`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1" />
```

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'seo/viewport': 'off'
  }
};
```
