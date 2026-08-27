---
title: seo/json-ld-deprecated-type · Deprecated structured-data type
description: Some schema types had their Google rich result dropped or restricted.
---

**Severity:** info

## What it checks

Flags a JSON-LD `@type` whose Google rich result was dropped or restricted (e.g. `HowTo`, `FAQPage`, `ClaimReview`).

## Why it matters

These types no longer reliably produce rich results, so the markup adds page weight without the SERP benefit.

## How to fix

Verify the type's current rich-result status in Google's documentation; remove or replace it if it no longer earns a rich result.

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) composes each route's `<head>` from `<svelte:head>` in the page and its layout chain, followed into repo-local components, plus the known meta components (`svelte-meta-tags`, `svelte-seo`) and any you declare in `metaComponents`. It judges only a **literal** value; it never examines a dynamic one. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads the shipped `<head>`, where every value is literal; the build pass covers prerendered routes only. When the two disagree, trust the rendered result.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/json-ld-deprecated-type': 'off'
  }
};
```
