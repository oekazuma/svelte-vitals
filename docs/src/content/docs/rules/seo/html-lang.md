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
