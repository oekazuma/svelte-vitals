---
title: seo/viewport · Viewport
description: Pages should declare a responsive viewport meta tag.
---

**Severity:** warning

## What it checks

Every route must expose a `<meta name="viewport">` tag (usually set once in `app.html`). A missing tag is flagged. Because the viewport tag normally lives in `app.html` — which static (CLI) mode does not resolve — this rule is evaluated in plugin/rendered mode only.

## Why it matters

Without a viewport meta tag the page is not mobile-responsive, which Google penalizes under mobile-first indexing.

## How to fix

Add the viewport meta tag, typically in `src/app.html`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1" />
```
