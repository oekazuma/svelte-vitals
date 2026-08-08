---
title: seo/twitter-card · Twitter Card
description: Pages should declare a twitter:card for rich sharing on X/Twitter.
---

**Severity:** info

## What it checks

Every route should include a `<meta name="twitter:card">` tag (own or inherited). A missing or empty tag is flagged.

## Why it matters

twitter:card selects how the page renders when shared on X/Twitter; without it the platform shows a basic link. (Open Graph tags act as fallbacks for the card's title and image.)

## How to fix

```svelte
<svelte:head>
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>
```
