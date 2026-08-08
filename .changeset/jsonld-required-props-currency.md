---
'@svelte-vitals/core': patch
---

`seo/json-ld-required-props`'s `REQUIRED_PROPS` table was stale against Google's current
structured-data requirements, producing warning-level false positives on valid markup. Re-verified
against developers.google.com:

- `Article`/`BlogPosting`/`NewsArticle`: row removed. Google lists no required properties for these
  types (`headline` is Recommended) — valid markup without a `headline` is no longer flagged.
- `Organization`: row removed. Google lists no required properties.
- `Product`: now `name` plus **at least one of** `review`, `aggregateRating`, or `offers` (was
  `name` + `offers` unconditionally). A `Product` with only `aggregateRating` or only `review` no
  longer flags a missing `offers`; a `Product` missing all three now names the group in the message
  ("missing … one of review, aggregateRating or offers").
- `Recipe`: now `name` + `image` only (was also requiring `recipeIngredient`/`recipeInstructions`,
  which Google does not require).
- `VideoObject`: `description` dropped (Google: Recommended, not Required); still requires `name`,
  `thumbnailUrl`, `uploadDate`.
- `Person`: now requires `name` **or** `alternateName` (was `name` unconditionally) — Google's
  guidance allows `alternateName` to stand in when `name` isn't available. A `Person` node with only
  `alternateName` no longer flags a missing `name`.
- `Event`, `LocalBusiness`, `WebSite`, `BreadcrumbList` verified unchanged.

No detection or message changes for any other JSON-LD rule.
