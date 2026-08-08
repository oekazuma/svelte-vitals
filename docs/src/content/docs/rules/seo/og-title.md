---
title: seo/og-title · Open Graph title
description: Every route should include a <meta property="og:title"> tag.
---

**Severity:** warning

## What it checks

Every route must include a `<meta property="og:title">` tag (own or inherited through the layout chain). A missing or empty Open Graph title meta tag is flagged.

## Why it matters

`og:title` controls the headline shown when the page is shared on social platforms, independent of the document `<title>`.

## How to fix

Add `<meta property="og:title">`, or set `openGraph.title` on your meta component:

```svelte
<svelte:head>
  <meta property="og:title" content="Page title" />
</svelte:head>
```
