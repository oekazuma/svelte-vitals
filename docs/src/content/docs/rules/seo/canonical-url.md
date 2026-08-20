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

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) composes each route's `<head>` from `<svelte:head>` in the page and its layout chain, followed into repo-local components, plus the known meta components (`svelte-meta-tags`, `svelte-seo`) and any you declare in `metaComponents`. A value it cannot read literally (`{data.title}`) is `dynamic`, judged by `treatDynamicAs`. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads the shipped `<head>`, where every value is literal and `treatDynamicAs` does not apply; the build pass covers prerendered routes only. When the two disagree, trust the rendered result.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/canonical-url': 'off'
  }
};
```
