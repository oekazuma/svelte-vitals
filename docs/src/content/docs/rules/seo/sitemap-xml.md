---
title: seo/sitemap-xml · sitemap.xml
description: Your project should provide a sitemap.xml file.
---

**Severity:** warning

## What it checks

The project should have a `sitemap.xml` — either at `static/sitemap.xml` or served via a `src/routes/sitemap.xml/+server` endpoint.

## Why it matters

A `sitemap.xml` lists your URLs so search engines can discover and prioritise them, especially pages not well linked internally.

## How to fix

Add `static/sitemap.xml` or a `src/routes/sitemap.xml/+server` endpoint:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
</urlset>
```

## Disabling

If this is intentional, turn the rule off:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'seo/sitemap-xml': 'off'
  }
};
```
