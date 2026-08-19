---
title: performance/render-blocking-script · Render-blocking script
description: A head <script src> should not block parsing.
---

**Severity:** warning

## What it checks

Flags a `<script src>` in `<head>` that runs as a classic script (no `type`, an empty `type`, or a JavaScript MIME type) and has neither `defer` nor `async` — whether authored in `src/app.html` (caught in rendered analysis) or in `<svelte:head>` (caught in source analysis). A head with no `<script>` is not checked.

Not flagged: `type="module"`, and non-executing types such as `type="importmap"`, `type="speculationrules"`, or a third-party runtime like `type="text/partytown"` — none of these run as a blocking classic script.

## Why it matters

A synchronous `<script src>` in `<head>` blocks HTML parsing until it downloads and runs, delaying first paint. `defer`, `async`, or `type="module"` avoids the block. SvelteKit's own scripts are already module/deferred — this catches hand-added blocking scripts.

## How to fix

Add `defer` (or `type="module"`) / `async`:

```html src/app.html
<script src="/analytics.js" defer></script>
```

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) composes each route's `<head>` from `<svelte:head>` in the page and its layout chain, followed into repo-local components, plus the known meta components (`svelte-meta-tags`, `svelte-seo`) and any you declare in `metaComponents`, and judges only a **literal** value — a dynamic one is not examined. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads the shipped `<head>`, where every value is literal; the build pass covers prerendered routes only. When the two disagree, trust the rendered result.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/render-blocking-script': 'off'
  }
};
```
