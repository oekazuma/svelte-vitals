---
title: PERF007 · Render-blocking script
description: A head <script src> should not block parsing.
---

**Severity:** warning

## What it checks

Flags a `<script src>` in `<head>` that has neither `defer`, `async`, nor `type="module"`. Such scripts live in `src/app.html`, so this rule is evaluated only in rendered analysis (the vite plugin).

## Why it matters

A synchronous `<script src>` in `<head>` blocks HTML parsing until it downloads and runs, delaying first paint. `defer`, `async`, or `type="module"` avoids the block. SvelteKit's own scripts are already module/deferred — this catches hand-added blocking scripts.

## How to fix

Add `defer` (or `type="module"`) / `async`:

```html
<\!-- src/app.html -->
<script src="/analytics.js" defer></script>
```
