---
title: seo/charset · Character encoding
description: The page should declare a character encoding with <meta charset>.
---

**Severity:** warning

## What it checks

Flags a rendered page with no `<meta charset>` declaration.

## Why it matters

Without a declared character encoding the browser must guess, which can render text as mojibake. `<meta charset="utf-8">` is the standard, unambiguous declaration and should be the first thing in `<head>`.

## How to fix

```html src/app.html
<head>
  <meta charset="utf-8" />
  %sveltekit.head%
</head>
```

## Mode differences

**Rendered analysis only** (the Vite plugin's build pass, a route you visit in the dashboard). The tag lives in `src/app.html`, which source analysis (the CLI, the dashboard's static baseline) does not resolve, so that pass reports nothing for this rule.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/charset': 'off'
  }
};
```
