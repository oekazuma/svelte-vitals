---
title: seo/title-length · Title length
description: The document title should be 30–60 characters.
---

**Severity:** info

## What it checks

Flags a static `<title>` whose visible text is shorter than 30 or longer than 60 characters. Whitespace is trimmed and collapsed before counting, and length is measured in grapheme clusters (an emoji counts as one character); dynamic titles are not checked.

## Why it matters

A title that is too short wastes the strongest on-page SEO signal; one that is too long is truncated in search results, hiding the end of your headline.

## How to fix

```svelte
<svelte:head>
  <title>Concise, descriptive page title (30–60 chars)</title>
</svelte:head>
```

## Configuration

| Option | Type    | Default |
| ------ | ------- | ------: |
| `min`  | integer |      30 |
| `max`  | integer |      60 |

```js svelte-vitals.config.js
export default {
  rules: { 'seo/title-length': { options: { min: 20, max: 40 } } }
};
```

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) measures the literal text you wrote in your source (or a static `title` prop on `svelte-meta-tags`/`svelte-seo`); a `titleTemplate` is not measured, since the wrapped title only takes its final form at render time. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) measures the shipped text; the build pass covers prerendered routes only. The dashboard's live layer runs on the hook's own options, so a `min`/`max` set in the config file applies to the static baseline only.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/title-length': 'off'
  }
};
```
