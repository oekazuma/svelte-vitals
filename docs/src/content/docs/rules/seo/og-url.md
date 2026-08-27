---
title: seo/og-url · Open Graph URL
description: Every route should include an og:url with its canonical address.
---

**Severity:** warning

## What it checks

Every route should include a `<meta property="og:url">` tag (own or inherited). A missing or empty tag is flagged.

## Why it matters

og:url tells social platforms the canonical address to attribute shares and likes to, consolidating engagement on one URL. The [Open Graph protocol](https://ogp.me/) lists `og:url` among its required properties, alongside `og:title`, `og:type`, and `og:image`.

`og:url` might seem redundant with `<link rel="canonical">`, since most consumers can fall back to the canonical URL when og:url is absent. But that conflates two different jobs: canonical tells search engines which URL to index, while og:url tells social platforms which URL to attribute shares to. Since the Open Graph spec itself treats `og:url` as required (unlike `og:description`, which it lists as optional; see [`seo/og-description`](/rules/seo/og-description)), the severity follows the spec's own required/optional split.

## How to fix

```svelte
<svelte:head>
  <meta property="og:url" content="https://example.com/this-page" />
</svelte:head>
```

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) composes each route's `<head>` from `<svelte:head>` in the page and its layout chain, followed into repo-local components, plus the known meta components (`svelte-meta-tags`, `svelte-seo`) and any you declare in `metaComponents`. A value it cannot read literally (`{data.title}`) is `dynamic`, judged by `treatDynamicAs`. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads the shipped `<head>`, where every value is literal and `treatDynamicAs` does not apply; the build pass covers prerendered routes only. When the two disagree, trust the rendered result.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/og-url': 'off'
  }
};
```
