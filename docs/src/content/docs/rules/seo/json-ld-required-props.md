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
