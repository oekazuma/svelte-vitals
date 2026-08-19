---
title: seo/json-ld-required-props · JSON-LD required properties
description: A recognized @type should include the properties its rich result requires.
---

**Severity:** warning

## What it checks

For a recognized `@type` (Product, BreadcrumbList, WebSite, Event, Recipe, VideoObject, LocalBusiness), checks that Google's required properties are present. Unknown/custom types are not flagged — and so are types (Article, BlogPosting, NewsArticle, Organization) for which Google's structured-data docs list no required properties at all, and Person, whose only Google-documented requirement applies to `ProfilePage.mainEntity`, a relationship this per-node check doesn't track.

## Why it matters

A recognized `@type` missing its required properties is ineligible for the corresponding rich result.

## How to fix

Add the missing properties. For example, a `Product` needs `name`, plus at least one of `review`, `aggregateRating`, or `offers`:

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "…",
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.5", "reviewCount": "89" }
}
```

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) composes each route's `<head>` from `<svelte:head>` in the page and its layout chain, followed into repo-local components, plus the known meta components (`svelte-meta-tags`, `svelte-seo`) and any you declare in `metaComponents`, and judges only a **literal** value — a dynamic one is not examined. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads the shipped `<head>`, where every value is literal; the build pass covers prerendered routes only. When the two disagree, trust the rendered result.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/json-ld-required-props': 'off'
  }
};
```
