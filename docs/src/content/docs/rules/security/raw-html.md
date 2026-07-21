---
title: security/raw-html · Raw HTML render
description: 'Sanitize the value — {@html} renders unescaped HTML.'
---

**Severity:** warning · **Category:** security

## What it checks

Flags every `{@html …}` in a component (static/CLI analysis of `src/**/*.svelte`).

## Why it matters

`{@html}` renders its value as unescaped HTML. If the value can contain user input and is not sanitized, it is a cross-site-scripting (XSS) vector. Static analysis can't prove sanitization, so each use is surfaced for review.

## How to fix

Sanitize before rendering, or render as text/markup instead:

```svelte
<script>
  import DOMPurify from 'dompurify';
  let { html } = $props();
</script>

{@html DOMPurify.sanitize(html)}
```
