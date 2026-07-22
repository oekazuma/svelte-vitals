---
title: seo/og-description · Open Graph description
description: Every route should include an og:description.
---

**Severity:** warning

## What it checks

Every route must include a `<meta property="og:description">` tag (own or inherited). A missing or empty tag is flagged.

## Why it matters

og:description is the summary shown under the title in social previews; without one, platforms guess or show nothing, lowering click-through.

## How to fix

```svelte
<svelte:head>
  <meta property="og:description" content="A concise page summary." />
</svelte:head>
```
