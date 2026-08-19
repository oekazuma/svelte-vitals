---
title: seo/title-presence · Title presence
description: Every route should resolve a non-empty <title>.
---

**Severity:** critical

## What it checks

Every route must resolve a non-empty `<title>` (own or inherited through the layout chain). A dynamic title (`<title>{data.title}</title>`) is the correct SvelteKit pattern and passes — only a genuinely missing or empty title is flagged.

## Why it matters

A unique, non-empty `<title>` is the single strongest on-page SEO signal and the text shown in search results and browser tabs.

## How to fix

Add a `<title>` inside `<svelte:head>` (a dynamic title is fine), or set it via your meta component:

```svelte
<svelte:head>
  <title>{data.title}</title>
</svelte:head>
```

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) composes each route's `<head>` from `<svelte:head>` in the page and its layout chain, followed into repo-local components, plus the known meta components (`svelte-meta-tags`, `svelte-seo`) and any you declare in `metaComponents`. A value it cannot read literally (`{data.title}`) is `dynamic`, judged by `treatDynamicAs`. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads the shipped `<head>`, where every value is literal and `treatDynamicAs` does not apply; the build pass covers prerendered routes only. When the two disagree, trust the rendered result.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/title-presence': 'off'
  }
};
```
