# The dev dashboard's live layer runs only the rules a single rendered route can answer

## The defect

`svelteVitalsHandle` analyses each visited route's rendered HTML with every selected rule, and
the dashboard store replaces a route's static result with the live one **per rule id**
(`composeSnapshot`). Two kinds of rule cannot be judged from one route's HTML, and both were
running anyway:

- **Cross-route rules** — `seo/duplicate-title`, `seo/duplicate-description` (the `uniquenessRule`
  pair) compare every route's text. The live layer hands them one head, so they always pass, and
  that PASS replaces the static finding for the visited route. Visit both routes of a real
  duplicate pair and the defect disappears from the dashboard while the titles are still the
  same. This is the lever-silently-lies class the repo fixes rather than documents.
- **Project-scope rules** — `seo/robots-txt` and `seo/sitemap-xml` ran against a stub
  (`hasRobotsTxt: true, hasSitemap: true`) and `seo/html-lang` against the rendered document; the
  other project-scope rules returned nothing under the stub. Their results are routeless; the store
  stamps the visited route onto them, and since it keeps static routeless results untouched, the
  snapshot then carries both the real static result and a per-visited-route copy — the
  robots/sitemap copies being fabricated passes.

## The change

`handle.ts` selects `rules.filter((r) => r.scope === 'route' && !r.crossRoute)`. `Rule` gains an
optional `crossRoute?: true` (internal surface only — `Rule` is not exported from the package
root), set in the `uniquenessRule` factory, so a rule built through it is excluded without a
hard-coded id list; a hand-written cross-route rule would have to set the flag itself. The project
stub goes away (`defaultProject`).

What a dashboard user sees: the live layer re-evaluates the route-scoped SEO / Performance /
Accessibility rules that judge a route on its own; project-scope rules and the cross-route pair
keep their static result. `seo/html-lang`'s live evaluation goes away with this — it only ever
duplicated the static routeless result, never replaced it, so nothing the dashboard resolved is
lost.

### Considered and not done: `a11y/required-element` in the live layer

Build mode evaluates it from the same parse; the handle's `ResolvedA11y` omits `elementTags`,
`elementsClosed`, and `file`, so the rule stays silent there and the static result stands. Adding
the three fields would make it run — but against the hook's own config only, which carries no
`overrides`, so a route whose required list comes from a config-file override would get a live
PASS that drops the static FAIL. Keeping it out of the live layer is the same "static stands"
outcome the rule already has, without that new wrong replacement.

## Guards

- `dev-handle.test.ts`: every id in the live payload maps to a rule in `allRules` with
  `scope === 'route'` and no `crossRoute` — generic, so a later leak of any kind fails it, and it
  pins the uniqueness pair and the project rules out by construction of the assertion.
- Guide: `dev-dashboard.mdx` (en + ja, stamped) states the rule set the live layer covers, and
  corrects its "only the rendered `<head>` is analyzed" note — body headings, images, landmarks,
  and ids are analysed too.
- Changesets: `@svelte-vitals/vite` patch (the fix), `@svelte-vitals/core` patch (the field). The
  core bump is load-bearing, not bookkeeping: vite pins core to the exact published version, and
  without it a published vite would read `!r.crossRoute` as vacuously true against the old core.
