---
title: a11y/doctype · Doctype
description: src/app.html should open with <!doctype html>.
---

**Severity:** info · **Category:** a11y

Scored `info` rather than `warning`: the accessibility half of this rule's premise has no source. Quirks mode is documented as a layout difference, and the WCAG criterion that used to justify markup-validity checks is obsolete and removed. The layout claim stands, so the rule stands — at the weight its remaining evidence supports.

## What it checks

Whether `src/app.html` opens with `<!doctype html>` (comments before it are allowed). Project-scoped: read once from `src/app.html`.

## Why it matters

Without a doctype browsers render in quirks mode, which applies different layout and box-model rules than standards mode — so a page can lay out differently from how its stylesheet was designed to behave.

## Mode differences

Source analysis only — the CLI and the live dashboard's static baseline read `src/app.html`. The Vite plugin's build pass analyses prerendered HTML and never reads `src/app.html`, so it reports nothing for this rule — even though a missing doctype is visible in the output it inspects — and the dashboard's live layer does not evaluate it either; the static result stands.

## How to fix

Add `<!doctype html>` as the first line of `src/app.html`:

```html
<!doctype html>
```

## Disabling

Record the existing finding in the suppressions file (`npx svelte-vitals --update-suppressions`), or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/doctype': 'off'
  }
};
```
