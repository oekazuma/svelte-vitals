---
title: seo/json-ld-validity · JSON-LD validity
description: A page's JSON-LD must be valid JSON with @context and @type.
---

**Severity:** warning

## What it checks

For each static `<script type="application/ld+json">`, the content must parse as JSON and contain both `@context` and `@type`. Invalid or incomplete JSON-LD is flagged. A dynamically-built JSON-LD is not checked in static mode.

## Unknown type

When a document's `@context` is schema.org, every bare `@type` name in it — at the root, in nested entities (`author`, `publisher`, `offers`, …), and in `@graph` members — is checked against the schema.org vocabulary. A name that isn't an exact, case-sensitive schema.org type produces a finding: `Unknown @type 'article' — not a schema.org type. Did you mean 'Article'?` The suggestion covers casing mismatches (`article`) and small typos — up to 2 dropped, added, or substituted characters (`Artcle`) — against the closest schema.org name; when nothing in the vocabulary is that close, the finding has no suggestion.

IRI (`https://schema.org/Article`) and prefixed (`schema:Article`) `@type` forms are valid JSON-LD and are never flagged — only bare names are checked.

A document whose `@context` mentions anything other than schema.org (an array containing any non-schema.org member, an object context, or a different vocabulary URL) is exempt from this check entirely: term remapping can legitimize a name this rule doesn't recognize. An array whose members are all schema.org URLs is still validated. The context match itself is case-sensitive (`https://schema.org`, `http://schema.org`, with or without a trailing slash) — an unusually-cased URL falls to the exemption side, never to a false positive.

The vocabulary is generated from [schema-dts](https://github.com/google/schema-dts) and updates whenever that dependency is bumped.

## Why it matters

Invalid JSON-LD — unparseable, missing `@context`/`@type`, or declaring a `@type` that isn't a real schema.org type — is silently ignored by search engines, so the structured data does nothing.

## How to fix

```svelte
<svelte:head>
  <script type="application/ld+json">
    { "@context": "https://schema.org", "@type": "WebPage", "name": "…" }
  </script>
</svelte:head>
```
