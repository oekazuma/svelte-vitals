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

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) composes each route's `<head>` from `<svelte:head>` in the page and its layout chain, followed into repo-local components, plus the known meta components (`svelte-meta-tags`, `svelte-seo`) and any you declare in `metaComponents`. A value it cannot read literally (`{data.title}`) is `dynamic`, judged by `treatDynamicAs`. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads the shipped `<head>`, where every value is literal and `treatDynamicAs` does not apply; the build pass covers prerendered routes only. When the two disagree, trust the rendered result.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/twitter-card': 'off'
  }
};
```
