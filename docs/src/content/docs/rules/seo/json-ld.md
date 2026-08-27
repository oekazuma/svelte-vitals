---
title: seo/json-ld · JSON-LD structured data
description: Every route should include JSON-LD structured data.
---

**Severity:** info

## What it checks

Every route should include a `<script type="application/ld+json">` JSON-LD block (own or inherited through the layout chain). A missing JSON-LD block is flagged.

## Why it matters

JSON-LD structured data lets search engines render rich results (breadcrumbs, articles, products) for the page.

## How to fix

Add a JSON-LD `<script>` inside `<svelte:head>` with literal JSON. Svelte emits the script body as-is, so an interpolation like `{JSON.stringify(...)}` would be emitted as that literal string and produce invalid JSON-LD:

```svelte
<svelte:head>
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Page title"
    }
  </script>
</svelte:head>
```

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) composes each route's `<head>` from `<svelte:head>` in the page and its layout chain, followed into repo-local components, plus the known meta components (`svelte-meta-tags`, `svelte-seo`) and any you declare in `metaComponents`. A value it cannot read literally (`{data.title}`) is `dynamic`, judged by `treatDynamicAs`; JSON-LD injected with `{@html}` in `<svelte:head>` is not a `<script>` element source analysis can see, so it reports Missing there, while rendered analysis finds it. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads the shipped `<head>`, where every value is literal and `treatDynamicAs` does not apply; the build pass covers prerendered routes only. When the two disagree, trust the rendered result.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/json-ld': 'off'
  }
};
```
