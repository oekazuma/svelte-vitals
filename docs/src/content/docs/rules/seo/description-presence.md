---
title: seo/description-presence · Description presence
description: Every route should include a <meta name="description">.
---

**Severity:** critical

## What it checks

Every route must include a `<meta name="description">` tag (own or inherited through the layout chain). A missing or empty description meta tag is flagged.

## Why it matters

A meta description is the snippet search engines show under your title; without one they invent one from page text, often poorly.

## How to fix

Add a `<meta name="description">` in `<svelte:head>`, or set the description on your meta component:

```svelte
<svelte:head>
  <meta name="description" content="A concise page summary." />
</svelte:head>
```
