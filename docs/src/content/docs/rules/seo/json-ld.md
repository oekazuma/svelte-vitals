---
title: seo/json-ld · JSON-LD structured data
description: Every route should include JSON-LD structured data.
---

**Severity:** info

## What it checks

Every route should include a `<script type="application/ld+json">` JSON-LD block (own or inherited through the layout chain), in `<head>` or `<body>`. A missing JSON-LD block is flagged.

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

**Source analysis** (the CLI, the dashboard's static baseline) composes each route's `<head>` from `<svelte:head>` in the page and its layout chain, followed into repo-local components, plus the tags in `src/app.html`'s `<head>`, the known meta components (`svelte-meta-tags`, `svelte-seo`, `svead`) and any you declare in `metaComponents`. A value it cannot read literally (`{data.title}`) is `dynamic`, judged by `treatDynamicAs`. A component a function mounts with `import()` renders only in the browser: its JSON-LD counts on a route with `ssr = false`, and not on a server-rendered route, whose HTML has none. JSON-LD counts wherever the document carries it, in `<body>` as well as `<head>`; one the body renders counts as a `dynamic` block. JSON-LD injected with `{@html}` is not a `<script>` element source analysis can see, so it counts as a `dynamic` JSON-LD block only when the expression's source text names it (`jsonld`, `json-ld` or `ld+json`, e.g. `{@html serializeJsonLd(data)}`), or the expression is a script binding whose initializer builds a tag with `type="application/ld+json"` (directly, or from another such binding); any other `{@html}` reports Missing there, while rendered analysis finds it. A block under a condition (`{#if ld}{@html ld}{/if}`) counts as present on every route that renders its component. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads the shipped `<head>`, and the JSON-LD in `<body>`, where every value is literal and `treatDynamicAs` does not apply; the build pass covers prerendered routes only. When the two disagree, trust the rendered result.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/json-ld': 'off'
  }
};
```
