---
title: seo/og-description · Open Graph description
description: Every route should include an og:description.
---

**Severity:** info

## What it checks

Every route should include a `<meta property="og:description">` tag (own or inherited). A missing or empty tag is reported as an informational finding.

## Why it matters

og:description is the summary shown under the title in social previews; without one, platforms guess or show nothing, lowering click-through.

This rule was `warning` before the 2026-08-09 severity review. The [Open Graph protocol](https://ogp.me/) lists `og:description` under Optional Metadata, unlike `og:url` (Basic/required — see [`seo/og-url`](/rules/seo/og-url)), so its severity was lowered to match the spec's own required/optional split.

## How to fix

```svelte
<svelte:head>
  <meta property="og:description" content="A concise page summary." />
</svelte:head>
```

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) composes each route's `<head>` from `<svelte:head>` in the page and its layout chain, followed into repo-local components, plus the known meta components (`svelte-meta-tags`, `svelte-seo`) and any you declare in `metaComponents`. A value it cannot read literally (`{data.title}`) is `dynamic`, judged by `treatDynamicAs`. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads the shipped `<head>`, where every value is literal and `treatDynamicAs` does not apply; the build pass covers prerendered routes only. When the two disagree, trust the rendered result.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/og-description': 'off'
  }
};
```
