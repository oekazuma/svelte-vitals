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

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'seo/json-ld-deprecated-type': 'off'
  }
};
```
