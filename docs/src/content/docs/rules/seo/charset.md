---
title: seo/charset · Character encoding
description: The page should declare a character encoding with <meta charset>.
---

**Severity:** warning

## What it checks

Flags a rendered page with no `<meta charset>` declaration. In SvelteKit the charset tag lives in `src/app.html`, so this rule is evaluated only in rendered analysis (the vite plugin); static (CLI) analysis emits nothing for it.

## Why it matters

Without a declared character encoding the browser must guess, which can render text as mojibake. `<meta charset="utf-8">` is the standard, unambiguous declaration and should be the first thing in `<head>`.

## How to fix

```html src/app.html
<head>
  <meta charset="utf-8" />
  %sveltekit.head%
</head>
```

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'seo/charset': 'off'
  }
};
```
