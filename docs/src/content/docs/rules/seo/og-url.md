---
title: seo/og-url · Open Graph URL
description: Every route should include an og:url with its canonical address.
---

**Severity:** warning

## What it checks

Every route should include a `<meta property="og:url">` tag (own or inherited). A missing or empty tag is flagged.

## Why it matters

og:url tells social platforms the canonical address to attribute shares and likes to, consolidating engagement on one URL. The [Open Graph protocol](https://ogp.me/) lists `og:url` among its required properties, alongside `og:title`, `og:type`, and `og:image`.

This rule was `info` before the 2026-08-09 severity review, on the reasoning that `og:url` is usually covered by `<link rel="canonical">` — most consumers can fall back to the canonical URL when og:url is absent. That's true, but it conflates two different jobs: canonical tells search engines which URL to index, while og:url tells social platforms which URL to attribute shares to. Since the Open Graph spec itself treats `og:url` as required (unlike `og:description`, which it lists as optional — see [`seo/og-description`](/rules/seo/og-description)), the severities now follow the spec's own required/optional split.

## How to fix

```svelte
<svelte:head>
  <meta property="og:url" content="https://example.com/this-page" />
</svelte:head>
```

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'seo/og-url': 'off'
  }
};
```
