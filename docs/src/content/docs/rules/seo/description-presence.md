---
title: seo/description-presence · Description presence
description: Every route should include a <meta name="description">.
---

**Severity:** warning

## What it checks

Every route must include a `<meta name="description">` tag (own or inherited through the layout chain). A missing or empty description meta tag is flagged.

## Why it matters

A meta description is the snippet search engines show under your title; without one they invent one from page text, often poorly.

`critical` is reserved for rules where the finding is either deploy-blocking (a crash, a security leak) or, for SEO, the one signal search engines always need (`seo/title-presence`). A description is different: Google explicitly says it only "sometimes" uses the provided description for the search snippet, generating one from page content the rest of the time. That makes a missing description a real but non-blocking issue: `warning`, alongside `seo/og-image` and `seo/canonical-url`, not the deploy-blocking tier.

## How to fix

Add a `<meta name="description">` in `<svelte:head>`, or set the description on your meta component:

```svelte
<svelte:head>
  <meta name="description" content="A concise page summary." />
</svelte:head>
```

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) composes each route's `<head>` from `<svelte:head>` in the page and its layout chain, followed into repo-local components, plus the known meta components (`svelte-meta-tags`, `svelte-seo`) and any you declare in `metaComponents`. A value it cannot read literally (`{data.title}`) is `dynamic`, judged by `treatDynamicAs`. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads the shipped `<head>`, where every value is literal and `treatDynamicAs` does not apply; the build pass covers prerendered routes only. When the two disagree, trust the rendered result.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/description-presence': 'off'
  }
};
```
