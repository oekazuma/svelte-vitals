---
title: seo/hreflang · hreflang validity
description: hreflang alternates should use valid codes and declare an x-default.
---

**Severity:** warning

## What it checks

Validates `<link rel="alternate" hreflang="…">` alternates. The rule is opt-in: a page with no hreflang alternates is never flagged. When alternates exist it flags:

- a malformed `hreflang` value (not `x-default` or a well-formed BCP-47 code such as `en`, `en-US`, `zh-Hant`, or `es-419`), and
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
