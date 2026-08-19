---
title: seo/html-lang · <html lang>
description: Your project's app.html should set the lang attribute on <html>.
---

**Severity:** warning

## What it checks

The `<html>` element in `src/app.html` should have a non-empty `lang` attribute. A missing or empty `lang` attribute is flagged.

## Why it matters

The `<html lang>` attribute tells screen readers how to pronounce the page, browsers whether to offer translation, and other assistive tools how to handle the content — Google has said it does not use `lang` for ranking.

## How to fix

Set `<html lang="...">` in `src/app.html`:

```text
<html lang="en">
```

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) reads the `<html lang>` attribute in `src/app.html`. **Rendered analysis** (the Vite plugin's build pass) reads the shipped document's `<html lang>` — the first prerendered page carrying one — so a value filled in at render time by a `handle` is judged there, not in source. The dashboard's live layer does not evaluate this rule; the static baseline's result stands.

## Disabling

If this is intentional, turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/html-lang': 'off'
  }
};
```
