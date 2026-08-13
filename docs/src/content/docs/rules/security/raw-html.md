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

<!-- svelte-vitals-disable-next-line security/raw-html -->
{@html DOMPurify.sanitize(html)}
```

Sanitizing still leaves `{@html}` in the source, so the finding persists by design — it isn't a bug in the rule, and there is no fix that clears it. Once you've reviewed the call and confirmed the value is sanitized, suppress it with the inline directive shown above (it must sit on the line directly above the `{@html}`).

A general-purpose HTML sanitizer is also the wrong tool for a non-HTML payload. The common example is JSON-LD: Svelte doesn't evaluate `{...}` expressions inside a `<script>` tag in markup — they render as literal text — so a dynamic JSON-LD block has to be injected with `{@html}`, and an HTML sanitizer isn't checking the right thing there. What makes that injection safe is script-safe serialization: escape `<` as `\u003c` (e.g. `JSON.stringify(data).replace(/</g, '\\u003c')`) so a `</script>` inside a string value can't close the tag early and turn the rest into markup. Reviewing the data as "trusted" isn't enough on its own — even honest data can contain `</script>`. Once the value is serialized that way (or is a fully literal, reviewed JSON block), suppress rather than routing it through an HTML sanitizer.
