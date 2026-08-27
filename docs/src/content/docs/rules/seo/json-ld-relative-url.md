---
title: seo/json-ld-relative-url · JSON-LD relative URL
description: URLs in JSON-LD should be absolute.
---

**Severity:** warning

## What it checks

Flags a relative value under a known URL key (`url`, `image`, `logo`, `sameAs`, `contentUrl`, `thumbnailUrl`) in JSON-LD. A value is considered absolute when it carries a URI scheme (`https:`, `data:`, `mailto:`, …) or is protocol-relative (`//host/…`); only scheme-less paths like `/logo.png` are flagged.

`@id` is **not** checked, because it is a node identifier that is commonly a relative fragment (e.g. `#organization`) cross-referencing nodes within the same `@graph`, which is a valid pattern rather than a broken URL.

## Why it matters

Search engines need absolute URLs in structured data; a relative URL can't be resolved reliably.

## How to fix

```json
"image": "https://example.com/logo.png"
```

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) composes each route's `<head>` from `<svelte:head>` in the page and its layout chain, followed into repo-local components, plus the known meta components (`svelte-meta-tags`, `svelte-seo`) and any you declare in `metaComponents`. It judges only a **literal** value; it never examines a dynamic one. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads the shipped `<head>`, where every value is literal; the build pass covers prerendered routes only. When the two disagree, trust the rendered result.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/json-ld-relative-url': 'off'
  }
};
```
