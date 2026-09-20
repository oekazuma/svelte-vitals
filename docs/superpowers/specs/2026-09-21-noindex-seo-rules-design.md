# `seo.indexable` — opting a whole project out of search-result rules

Status: implemented.

## Problem

A private / `noindex` app hand-writes the same block of `'off'` entries. Two projects
(`kakikaki`, `table-duel`) arrived at the same ten lines independently, and the one rule left
on by mistake (`seo/title-length`) duly reported a short title on a page that never appears in
a search result.

## Decision

A single config switch:

```ts
export default defineConfig({
  seo: { indexable: false }
});
```

turns off the rules that only pay off for a page in a search result. It expands to the exact
`rules: { <id>: 'off' }` entries a user writes today, before `--rules` / `--ignore` layer on
top, so every downstream consumer — `selectRules`, the scorer's denominator, `applyOverrides`,
the dashboard — needs no new notion of "not counted".

Covered: `seo/canonical-url`, `seo/og-title`, `seo/og-description`, `seo/og-image`,
`seo/og-url`, `seo/twitter-card`, `seo/json-ld`, `seo/sitemap-xml`, `seo/sitemap-in-robots`,
`seo/title-length`, `seo/description-length`.

Not covered: `seo/single-h1` (a primary heading is document structure, useful to assistive
technology either way) and `seo/robots-txt` (a `noindex` meta is only read after the page is
crawled, so `robots.txt` still does real work). The JSON-LD _validity_ rules stay on too — a
document that exists should be correct whether or not it is indexed.

## Rejected: deriving it from `seo/indexability`

Demoting rules automatically on each route `seo/indexability` resolves as `noindex` was the
issue's other proposal. Two reasons against it:

- `seo/sitemap-xml` and `seo/sitemap-in-robots` are `scope: 'project'`. There is no route to
  key on, so the ten manual `'off'` lines would shrink to two, not zero.
- An _accidental_ `noindex` on a public route would silence every search-result finding for it.
  `seo/indexability` is only `info`, so `failOn: 'warning'` never catches the mistake — the tool
  would go quiet exactly where it should be loudest. The 2026-07-18 overrides design listed this
  idea as out of scope for the same kind of reason.

An explicit switch has neither failure mode: the user states the intent, and an accidental
`noindex` still gets the full rule set.

## Guards

- Guard (1), observable effect: `examples/kitchen-sink/test/e2e-suppression.test.ts` runs the
  gallery under `seo: { indexable: false }` on a scratch copy and asserts the covered rules
  report nothing while an uncovered SEO rule still does.
- Guard (2), "selects nothing" warning: not applicable. `indexable: false` always selects the
  covered rules — there is no configuration under which the lever matches nothing.

An explicit `rules` entry still wins over the switch (the expansion is spread _under_ the user's
map), so `seo: { indexable: false }` with `rules: { 'seo/og-title': 'warning' }` keeps og:title on.
