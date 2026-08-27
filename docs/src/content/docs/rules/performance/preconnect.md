---
title: performance/preconnect · Preconnect third-party origin
description: Preconnect to third-party origins used by the page.
---

**Severity:** info

## What it checks

Flags a resource from a well-known third-party origin (currently Google Fonts: `fonts.googleapis.com`, `fonts.gstatic.com`) referenced without a `<link rel="preconnect">` (or `dns-prefetch`) for that origin. Routes that reference no such origin are not checked.

## Why it matters

Connecting to a third-party origin (DNS + TCP + TLS) is costly; a `preconnect`/`dns-prefetch` hint starts it early so the resource arrives sooner.

## How to fix

Add a preconnect hint for the third-party origin:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
```

## Configuration

| Option    | Type              | Default                                     |
| --------- | ----------------- | ------------------------------------------- |
| `origins` | list of hostnames | `fonts.googleapis.com`, `fonts.gstatic.com` |

Configured origins are **added to** the built-in list, rather than replacing it, so a project keeps
checking the Google Fonts origins even after adding its own, and picks up any origin the built-in
list grows to cover in a later svelte-vitals release.

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/preconnect': { options: { origins: ['cdn.example.com'] } }
  }
};
```

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) composes each route's `<head>` from `<svelte:head>` in the page and its layout chain, followed into repo-local components, plus the known meta components (`svelte-meta-tags`, `svelte-seo`) and any you declare in `metaComponents`. It judges only a **literal** value; it never examines a dynamic one. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads the shipped `<head>`, where every value is literal; the build pass covers prerendered routes only. When the two disagree, trust the rendered result.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/preconnect': 'off'
  }
};
```
