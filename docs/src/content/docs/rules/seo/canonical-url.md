---
title: seo/canonical-url · Canonical URL
description: Every route should include a <link rel="canonical"> tag.
---

**Severity:** warning

## What it checks

Every route should include a `<link rel="canonical">` tag (own or inherited through the layout chain). A missing or empty canonical link is flagged.

## Why it matters

A canonical URL tells search engines which URL is authoritative, preventing duplicate-content dilution across query-string variants of the same page. (SvelteKit normalizes trailing slashes itself by default, so that particular variant isn't a concern here.)

## How to fix

Add `<link rel="canonical">` in `<svelte:head>`, or set the canonical prop on your meta component:

```svelte
<svelte:head>
  <link rel="canonical" href="https://example.com/this-page" />
</svelte:head>
```

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'seo/canonical-url': 'off'
  }
};
```
