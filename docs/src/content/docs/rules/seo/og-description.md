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
