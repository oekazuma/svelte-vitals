---
title: seo/hreflang · hreflang validity
description: hreflang alternates should use valid codes and declare an x-default.
---

**Severity:** warning

## What it checks

Validates `<link rel="alternate" hreflang="…">` alternates. The rule is opt-in: a page with no hreflang alternates is never flagged. When alternates exist it flags:

- a malformed `hreflang` value (not `x-default` or a well-formed BCP-47 code such as `en`, `en-US`, `zh-Hant`, or `es-419`), and
- a set of two or more alternates with no `x-default`.

## Why it matters

A malformed hreflang code or a missing `x-default` breaks international targeting, so search engines may serve the wrong language version or ignore the annotations.

## How to fix

```svelte
<svelte:head>
  <link rel="alternate" hreflang="en" href="https://example.com/en/" />
  <link rel="alternate" hreflang="de" href="https://example.com/de/" />
  <link rel="alternate" hreflang="x-default" href="https://example.com/" />
</svelte:head>
```
