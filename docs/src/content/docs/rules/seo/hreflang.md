---
title: seo/hreflang · hreflang validity
description: hreflang alternates should use valid codes; x-default is recommended for selector/redirect pages.
---

**Severity:** warning

## What it checks

Validates `<link rel="alternate" hreflang="…">` alternates. The rule is opt-in: a page with no hreflang alternates is never flagged. When alternates exist it flags:

- a malformed `hreflang` value — not `x-default`, or a language(-script)(-region) code such as `en`, `en-US`, `zh-Hant`, or `es-419` — and
- a set of two or more alternates with no `x-default` declared.

## Why it matters

A malformed hreflang code breaks international targeting outright — search engines may serve the wrong language version or ignore the annotations entirely.

A missing `x-default` is a different kind of finding. [Google's own guidance](https://developers.google.com/search/docs/specialty/international/localized-versions) says to "consider adding a fallback page for unmatched languages, especially on language/country selectors or auto-redirecting home pages" — a recommendation for that specific shape of page, not a defect on every multilingual site. A page that lists a fixed set of language alternates without a language selector or auto-redirect has no unmatched-language visitor to fall back for, so skipping `x-default` there is a legitimate choice, not an oversight.

## How to fix

```svelte
<svelte:head>
  <link rel="alternate" hreflang="en" href="https://example.com/en/" />
  <link rel="alternate" hreflang="de" href="https://example.com/de/" />
  <link rel="alternate" hreflang="x-default" href="https://example.com/" />
</svelte:head>
```

## Limitations

Validation covers a pragmatic subset of BCP-47 — language, optional script, optional region — not the full grammar. BCP-47 variants and extensions (e.g. `de-DE-1996`, `en-US-u-hc-h12`) are valid hreflang values but are not recognized here and will be flagged as malformed.

## Mode differences

**Source analysis** (the CLI, the dashboard's static baseline) composes each route's `<head>` from `<svelte:head>` in the page and its layout chain, followed into repo-local components, plus the known meta components (`svelte-meta-tags`, `svelte-seo`) and any you declare in `metaComponents`, and judges only a **literal** value — a dynamic one is not examined. **Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard) reads the shipped `<head>`, where every value is literal; the build pass covers prerendered routes only. When the two disagree, trust the rendered result.

## Disabling

Record existing findings in the suppressions file (`npx svelte-vitals --update-suppressions`), scope the rule per route or path with `overrides`, or turn it off:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/hreflang': 'off'
  }
};
```
