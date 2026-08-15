---
title: seo/json-ld-date-format · JSON-LD date format
description: Date properties in JSON-LD should be ISO-8601.
---

**Severity:** info

## What it checks

Flags a value under a known date key (`datePublished`, `dateModified`, `startDate`, …) that is not ISO-8601. Reduced precision allowed by schema.org is accepted — year (`2026`), year-month (`2026-06`), full date, and date-time all pass.

## Why it matters

Schema.org date properties expect ISO-8601; other formats may be ignored or misparsed.

## How to fix

```json
"datePublished": "2026-06-26"
```

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'seo/json-ld-date-format': 'off'
  }
};
```
