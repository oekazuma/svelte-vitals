---
title: seo/heading-level-skip · Heading order
description: Heading levels should not be skipped.
---

**Severity:** info

## What it checks

Flags a heading whose level jumps more than one step over the previous heading (for example `<h2>` directly followed by `<h4>`). Presence of a single `<h1>` is covered by SEO027.

## Why it matters

Skipping a heading level breaks the document outline that search engines and assistive technology rely on to understand page structure.

## How to fix

```svelte
<h1>Page title</h1><h2>Section</h2><h3>Subsection</h3>
```
