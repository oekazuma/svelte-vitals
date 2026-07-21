---
title: seo/html-lang · <html lang>
description: Your project's app.html should set the lang attribute on <html>.
---

**Severity:** warning

## What it checks

The `<html>` element in `src/app.html` must have a non-empty `lang` attribute. A missing or empty `lang` attribute is flagged.

## Why it matters

The `<html lang>` attribute declares the page language for search engines, screen readers, and translation tools.

## How to fix

Set `<html lang="...">` in `src/app.html`:

```html
<html lang="en"></html>
```
