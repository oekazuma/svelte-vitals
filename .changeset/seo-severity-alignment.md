---
'@svelte-vitals/core': minor
---

The CLI's default gate is `--fail-on critical`, so a project failing only on a missing
`<meta name="description">` now exits `0` instead of `1` (a deliberate loosening); a project
relying on `--fail-on warning` and failing only on a multi-`<h1>` page now also exits `0` instead
of `1`, for the same reason. No other rule's severity changed, so no other gate behavior changes.
Realigned four SEO rule severities with their underlying evidence, following the 2026-08-09
rule-validity review's Priority-2 findings.

Two of the four changes shrink the `seo::route` scoring pair's total weight from 110 to 100
(description-presence −10, og-url +4, og-description −4, net −10) — so a project's SEO/Health
score can shift by a point or two even with no finding changes at all, simply because the
denominator moved. `single-h1` and `hreflang` don't affect the pair's weight (see below).

- `seo/description-presence`: `critical` → `warning`. `critical` now uniformly means
  deploy-blocking (the three crash/security rules, plus `seo/title-presence`) — Google only
  "sometimes" uses the provided meta description for the search snippet, generating one from page
  content the rest of the time, so a missing one is real but non-blocking.
- `seo/og-url`: `info` → `warning`, and `seo/og-description`: `warning` → `info` — swapped to match
  the [Open Graph protocol](https://ogp.me/)'s own required/optional split (`og:url` is Basic/required
  metadata; `og:description` is Optional). The previous ordering's "og:url is covered by canonical"
  rationale conflated two different jobs (canonical targets search engines, og:url targets social
  platforms) and is now recorded as historical context in the `og:url` docs page.
- `seo/single-h1`: severity split — a page with zero `<h1>` stays `warning` (a real primary-heading
  gap); two or more `<h1>` is demoted to `info` (a single `<h1>` is the conventional signal, but no
  official source documents a ranking penalty for several, so it's a style nit, not a defect). The
  rule's own registered severity (read by scoring's inventory and the rules index) stays `warning`
  — only the per-finding severity is split, so the `seo::route` pair's total weight is unaffected.
  A global `rules: { 'seo/single-h1': <severity> }` override flattens both arms back to one
  severity, same as any other rule.
- `seo/hreflang`: wording only, severity unchanged (`warning`). The "2+ alternates without
  x-default" message and recommendation no longer imply a defect — Google's guidance frames
  `x-default` as something to "consider," specifically for language-selector or auto-redirecting
  pages, not a requirement for every multilingual site. The malformed-hreflang-code arm is
  unchanged.
