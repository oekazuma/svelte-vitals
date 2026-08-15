---
title: a11y/doctype · Doctype
description: src/app.html should open with <!doctype html>.
---

**Severity:** warning · **Category:** a11y

## What it checks

Whether `src/app.html` opens with `<!doctype html>` (comments before it are allowed). Project-scoped: read once from `src/app.html`.

## Why it matters

Without a doctype browsers render in quirks mode, breaking CSS and accessibility tree behavior.

## How to fix

Add `<!doctype html>` as the first line of `src/app.html`:

```html
<!doctype html>
```

## Disabling

If this is intentional, turn the rule off:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'a11y/doctype': 'off'
  }
};
```
