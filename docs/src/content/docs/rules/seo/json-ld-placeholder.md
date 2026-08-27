---
title: seo/json-ld-placeholder · JSON-LD placeholder text
description: JSON-LD should not contain unreplaced placeholder text.
---

**Severity:** info

## What it checks

Flags obvious placeholder/boilerplate text (e.g. `lorem ipsum`, `Your Company Name`) left in a JSON-LD value.

## Why it matters

Leftover placeholder text ships misleading structured data to search engines.

## How to fix

Replace the placeholder with the real value for the page.

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) composes each route's `<head>` from `<svelte:head>` in the page and its layout chain, followed into repo-local components, plus the known meta components (`svelte-meta-tags`, `svelte-seo`) and any you declare in `metaComponents`. It judges only a **literal** value; it never examines a dynamic one. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads the shipped `<head>`, where every value is literal; the build pass covers prerendered routes only. When the two disagree, trust the rendered result.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/json-ld-placeholder': 'off'
  }
};
```
