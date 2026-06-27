---
title: PERF008 · Preconnect third-party origin
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
