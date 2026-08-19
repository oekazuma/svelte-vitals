---
title: seo/description-length · Description length
description: The meta description should be 70–160 characters.
---

**Severity:** info

## What it checks

Flags a static `<meta name="description">` whose content is shorter than 70 or longer than 160 characters. Whitespace is trimmed and collapsed before counting, and length is measured in grapheme clusters (an emoji counts as one character); dynamic descriptions are not checked.

## Why it matters

A description that is too short under-uses the search snippet; one that is too long is truncated by search engines, cutting off your call to action.

## How to fix

```svelte
<svelte:head>
  <meta name="description" content="A concise, compelling summary of the page in roughly 70–160 characters." />
</svelte:head>
```

## Configuration

| Option | Type    | Default |
| ------ | ------- | ------: |
| `min`  | integer |      70 |
| `max`  | integer |     160 |

```js svelte-vitals.config.js
export default {
  rules: { 'seo/description-length': { options: { min: 50, max: 155 } } }
};
```

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) measures the literal content you wrote in your source (or a static `description` prop on `svelte-meta-tags`/`svelte-seo`). **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) measures the shipped content; the build pass covers prerendered routes only. The dashboard's live layer runs on the hook's own options, so a `min`/`max` set in the config file applies to the static baseline only.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/description-length': 'off'
  }
};
```
