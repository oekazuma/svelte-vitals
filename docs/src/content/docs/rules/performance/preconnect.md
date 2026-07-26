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

Configured origins are **added to** the built-in list, not a replacement for it — a project keeps
checking the Google Fonts origins even after adding its own, and picks up any origin the built-in
list grows to cover in a later svelte-vitals release.

```js
// svelte-vitals.config.js
export default {
  rules: {
    'performance/preconnect': { options: { origins: ['cdn.example.com'] } }
  }
};
```
