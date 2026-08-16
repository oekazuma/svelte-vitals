---
title: a11y/doctype · Doctype
description: src/app.html should open with <!doctype html>.
---

**Severity:** warning · **Category:** a11y

## What it checks

Whether `src/app.html` opens with `<!doctype html>` (comments before it are allowed). Project-scoped: read once from `src/app.html`.

## Why it matters

Without a doctype browsers render in quirks mode, which applies different layout and box-model rules than standards mode — so a page can lay out differently from how its stylesheet was designed to behave.

## Mode differences

CLI only. The Vite plugin analyses prerendered HTML and never reads `src/app.html`, so this rule reports nothing in plugin mode — even though a missing doctype is visible in the output it inspects.

## How to fix

Add `<!doctype html>` as the first line of `src/app.html`:

```html
<!doctype html>
```

## Disabling

Record the existing finding in the suppressions file (`npx svelte-vitals --update-suppressions`), or turn the rule off:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'a11y/doctype': 'off'
  }
};
```
