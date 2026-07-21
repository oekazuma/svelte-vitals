---
title: seo/og-url · Open Graph URL
description: Every route should include an og:url with its canonical address.
---

**Severity:** info

## What it checks

Every route should include a `<meta property="og:url">` tag (own or inherited). A missing tag is flagged.

## Why it matters

og:url tells social platforms the canonical address to attribute shares and likes to, consolidating engagement on one URL.

## How to fix

```svelte
<svelte:head>
  <meta property="og:url" content="https://example.com/this-page" />
</svelte:head>
```
