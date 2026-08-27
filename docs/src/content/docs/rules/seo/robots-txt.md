---
title: seo/robots-txt · robots.txt
description: Your project should provide a robots.txt file.
---

**Severity:** warning

## What it checks

The project should have a `robots.txt`, either at `static/robots.txt` or served via a `src/routes/robots.txt/+server` endpoint.

## Why it matters

`robots.txt` tells crawlers which paths they may fetch and points them to your sitemap; missing it leaves crawl behaviour to defaults.

## How to fix

Add `static/robots.txt` or a `src/routes/robots.txt/+server` endpoint:

```text
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml
```

## Mode differences

None. The check looks for the file or its `+server` endpoint in the project and is the same on every surface, including a `--route` run. The dashboard's live layer does not re-evaluate site-wide rules; the static baseline's result stands.

## Disabling

If this is intentional, turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/robots-txt': 'off'
  }
};
```
