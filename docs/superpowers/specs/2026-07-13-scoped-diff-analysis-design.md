# Design spike: avoiding a full-project re-analysis for `--diff`/`--staged`/`--baseline`

**Date:** 2026-07-13
**Status:** Spike complete — not approved for implementation. Maintainer must pick a
recommendation (or reject) before any follow-up implementation plan is written.
**Packages:** `svelte-vitals` (CLI) only. No `@svelte-vitals/core` changes proposed.
**Plan:** `plans/036-design-spike-scoped-diff-baseline-analysis.md`

## Goal

`--diff`/`--staged`/`--baseline` exist so a PR gate can look only at what a change
actually touched. Today all three still pay the cost of a **full** project
analysis and only filter the *output* afterward:

- `analyzeProject` (`packages/cli/src/index.ts:172-207`) takes no changed-file
  information at all — it always globs every route, walks every layout chain,
  and runs every rule over the whole project.
- `applyScope` (`packages/cli/src/index.ts:235-288`) runs `filterToChangedFiles`
  (`packages/cli/src/changed-files.ts`) / `filterToNewFindings`
  (`packages/cli/src/baseline.ts`) **after** that full analysis, dropping
  findings whose `location` isn't in the changed set.
- `--baseline` additionally checks out the base ref into a temporary git
  worktree (`checkoutBaseline`, `packages/cli/src/baseline.ts`) and runs a
  **second** full `analyzeProject` against it.

On a large SvelteKit app, a pre-commit hook or PR gate that only touched one
route pays the full-project cost anyway (twice, for `--baseline`). This spike
asks: can analysis be scoped to *only the routes affected by what changed*,
and if so, where does that scoping stop being safe?

The answer is not a blanket yes. Some rules are correct only when they see
the whole project's data at once (SEO028/SEO029, duplicate title/description
detection). Scoping naively would make a PR gate **silently miss a real
regression** — the single most dangerous failure mode for a code-health tool,
worse than the status quo of "slow but correct."

## Step 1 — rule classification (all 49 rules in `allRules`)

Every rule's `check(ctx: RuleContext)` was read directly (not inferred from
the `scope: 'route' | 'project' | 'component'` field on `Rule` — see the
callout below, that field answers a different question). Three buckets:

- **Route-independent** — the rule's verdict for route `R` depends only on
  `R`'s own resolved head/images/headings (i.e., only on files in `R`'s
  layout chain). Sibling routes existing, being added, or being removed
  changes nothing about `R`'s own result.
- **Component/file-independent** — same idea, but for `ctx.components`
  (Correctness/Security/Architecture rules): the verdict for file `F` depends
  only on `F`'s own parsed facts.
- **Cross-route** — the rule's verdict for route `R` genuinely depends on
  *other* routes' data. Scoping to only `R` changes the answer.
- **Project-fact** — the rule ignores routes/components entirely and reads
  `ctx.project` (a handful of whole-repo file-existence/content checks:
  `static/robots.txt`, `static/sitemap.xml`, `src/app.html`'s `<html lang>`).
  These findings never carry a `location`, so `filterToChangedFiles` already
  drops them post-hoc today — but computing `ctx.project` itself is cheap
  (a handful of `exists`/`readFile` calls, not proportional to route count),
  so there's no perf reason to skip it regardless of scoping strategy.

| Rule ID | Category | Classification | Basis |
|---|---|---|---|
| SEO001 | seo | Route-independent | `seo001-title.ts`: `ctx.heads.map(...)`, per-head only |
| SEO002 | seo | Route-independent | `headTagRule` builder, per-head only |
| SEO003 | seo | Route-independent | `headTagRule` builder |
| SEO004 | seo | Route-independent | `headTagRule` builder |
| SEO005 | seo | Route-independent | `headTagRule` builder |
| SEO006 | seo | Project-fact | `project-rules.ts`: reads `ctx.project.hasRobotsTxt` only |
| SEO007 | seo | Project-fact | `project-rules.ts`: reads `ctx.project.hasSitemap` only |
| SEO008 | seo | Route-independent | `headTagRule` builder |
| SEO009 | seo | Project-fact | `project-rules.ts`: reads `ctx.project.htmlLang` (app.html) |
| PERF001 | performance | Route-independent | `imageRule` builder, per-route `ctx.images` entry only |
| PERF002 | performance | Route-independent | `imageRule` builder |
| PERF003 | performance | Route-independent | `linkRule` builder, per-head only |
| PERF004 | performance | Route-independent | `linkRule` builder |
| SEO010 | seo | Route-independent | `seo010-015.ts`: loop over `ctx.heads`, per-head only |
| SEO011 | seo | Route-independent | `headTagRule` builder |
| SEO012 | seo | Route-independent | `headTagRule` builder |
| SEO013 | seo | Route-independent | `headTagRule` builder |
| SEO014 | seo | Route-independent | `headTagRule` builder (`appliesTo: rendered` gate, still per-head) |
| SEO015 | seo | Project-fact | reads `ctx.project.{hasRobotsTxt,hasSitemap,robotsReferencesSitemap}` only |
| SEO016 | seo | Route-independent | `seo016-021.ts`: per-head JSON-LD parse, no cross-route read |
| SEO017 | seo | Route-independent | `jsondRule` builder over the same file, per-head |
| SEO018 | seo | Route-independent | `jsonldRule` builder |
| SEO019 | seo | Route-independent | `jsonldRule` builder |
| SEO020 | seo | Route-independent | `jsonldRule` builder |
| SEO021 | seo | Route-independent | `jsonldRule` builder |
| SEO022 | seo | Route-independent | `seo022-023.ts` `lengthRule` builder, per-head |
| SEO023 | seo | Route-independent | `lengthRule` builder |
| SEO024 | seo | Route-independent | `headTagRule` builder (`appliesTo: rendered`) |
| SEO025 | seo | Route-independent | `imageRule` builder |
| SEO026 | seo | Route-independent | `seo026-hreflang.ts`: per-head `<link alternate>` set, no cross-route |
| SEO027 | seo | Route-independent | `seo027-heading.ts`: per-route `ctx.headings` entry only |
| PERF005 | performance | Route-independent | `perf005-lcp-image.ts`: per-route `ctx.images` entry only |
| PERF006 | performance | Route-independent | `imageRule` builder |
| PERF007 | performance | Route-independent | `perf007-render-blocking.ts`: per-head `<script>` set only |
| PERF008 | performance | Route-independent | `perf008-preconnect.ts`: per-head host tracking, no cross-route reads |
| **SEO028** | seo | **Cross-route** | `seo028-029-uniqueness.ts`: builds a `Map<text, count>` over **every** `ctx.heads` entry before deciding any one route's verdict |
| **SEO029** | seo | **Cross-route** | same file, same mechanism (description instead of title) |
| SEO030 | seo | Route-independent | `seo030-heading-order.ts`: per-route `ctx.headings` entry only |
| CORRECT001 | correctness | Component/file-independent | `componentRule` builder, per-file `ctx.components` entry only |
| CORRECT002 | correctness | Component/file-independent | `componentRule` builder |
| CORRECT003 | correctness | Component/file-independent | `componentRule` builder |
| CORRECT004 | correctness | Component/file-independent | `componentRule` builder |
| CORRECT005 | correctness | Component/file-independent | `componentRule` builder |
| SEC001 | security | Component/file-independent | `componentRule` builder |
| SEC002 | security | Component/file-independent | `componentRule` builder |
| ARCH001 | architecture | Component/file-independent | `componentRule` builder |
| ARCH002 | architecture | Component/file-independent | `componentRule` builder |
| PERF009 | performance | Component/file-independent | `componentRule` builder |
| PERF010 | performance | Component/file-independent | `componentRule` builder |

**Result: 34 route-independent, 11 component/file-independent, 4 project-fact,
2 cross-route (SEO028, SEO029).** No rule fell into an "unclear from the code"
bucket — every `check` function was legible enough to classify with
confidence, so the STOP condition about ambiguous rules did not trigger.

### Callout: the existing `scope: 'route' | 'project' | 'component'` field answers a *different* question

`Rule.scope` (`packages/core/src/rule.ts:26`) already exists, and it's tempting
to assume it already encodes this spike's classification. **It doesn't.** Its
doc comment says "'route' = evaluated per route, 'project' = site-wide" — that
is a statement about **output cardinality** (does this rule emit one Result
per route, or a single project-level Result?), not about **input
dependency** (does computing that Result require other routes' data?).

SEO028/SEO029 are the proof: both are declared `scope: 'route'` (they emit one
Result per route, same as SEO001), yet their `check` function is exactly the
cross-route case this spike is warning about. Any future implementation must
not reuse `Rule.scope` as a shortcut for "safe to scope" — it would silently
misclassify SEO028/SEO029 as safe. A new field (e.g. `dataDependency:
'route' | 'component' | 'project-wide'`) or an explicit allowlist/denylist
would be needed instead.

## Step 2 — layout-chain reverse lookup

`chainFiles(pageRel, layouts)` (`packages/cli/src/providers/source/routes.ts:98`)
already computes, forward, "which files does this page's layout chain
include" (root → leaf, breakout-aware). The reverse question — "given a
changed file, which pages have it in their chain" — is a straightforward
`O(pages × chain length)` scan:

```ts
function affectedPages(changedFileRel: string, pages: string[], layouts: Map<string, string>): string[] {
  return pages.filter((page) => chainFiles(page, layouts).some((f) => f.rel === changedFileRel));
}
```

This was prototyped and exercised in Step 3 (below). Two structural findings:

1. **Enumerating pages/layouts is cheap; walking chains is where the cost is.**
   `enumerateRoutePages` and `collectLayouts` (`packages/cli/src/providers/source/project.ts`,
   `routes.ts:74`) are glob calls — proportional to file count, not to parse
   cost. The expensive step is `resolveRoute` (`routes.ts:131`): reading,
   parsing, and transitively resolving each page's own component tree
   (`resolveFileTags`, depth-limited to 5, cycle-guarded). `collectRoutes`
   already shares one `ParseCache` (Plan 034) across all routes in a run, so a
   shared layout is parsed once regardless of how many routes reference it —
   the *marginal* cost of one additional in-scope route is roughly "walk its
   own chain once," not "re-parse everything." This means the reverse-lookup
   approach, if built, would need `enumerateRoutePages`/`collectLayouts` to run
   unconditionally (they're cheap) but could then call `resolveRoute` only for
   the pages in `affectedPages(...)`, skipping the rest entirely.

2. **A change to a route/layout file is cheap to scope; a change to a shared
   `$lib` component is not, in general.** The reverse lookup above only
   answers "which routes have `changedFile` *as a route/layout file* in their
   chain" (the changed file must itself be a `+page.svelte`/`+layout.svelte`
   somewhere in `src/routes`). If the changed file is a `$lib` component
   imported by an unknown subset of pages (directly, or transitively through
   another component, up to `MAX_DEPTH = 5`), determining "which routes are
   affected" requires either:
   - building a full reverse import graph across every route's component
     tree (a strict superset of the cost `resolveFileTags` already pays per
     route — i.e., not obviously cheaper than just resolving every route), or
   - falling back to "unknown → treat as affecting every route" whenever the
     changed file is not itself a route/layout file.

   The prototype did not attempt the import-graph approach — the plan
   deliberately scoped this as an open question rather than a build task (see
   Open Questions). The practical implication: **the common case a real
   implementation should target is "the diff touched one or a few
   `+page.svelte`/`+layout.svelte` files directly"**; a diff that only touches
   `$lib/*.svelte` should fall back to full-project analysis rather than
   guess.

3. **A change to a near-root layout affects everything anyway.** The
   reverse lookup correctly reports "every page" when the changed file is the
   root (or a near-root) layout, since every page's chain includes it. This
   is not a bug in the approach — it is a real, unavoidable limit on how much
   a `--diff` gate can save: editing `src/routes/+layout.svelte` (a common
   place to add a meta component, change `<html lang>` wiring, etc.) legitimately
   requires re-resolving every route. The savings this design targets are
   real but bounded to leaf-ish changes, which is nonetheless the common case
   for `--staged`/pre-commit (a single page edited at a time).

## Step 3 — prototype (throwaway) and its finding

A disposable spike test was added at
`packages/cli/test/spike-plan036-scoped-diff-analysis.test.ts`
(**not integrated into any production code path — see the file-level comment;
delete once this doc has captured its findings, unless a follow-up
implementation plan builds on it**). It uses `createMemoryRuntime` fixtures
(no changes to `packages/cli/test/fixtures/`) and exercises three claims
directly against the real `collectRoutes`/rule `check` functions:

1. **Reverse lookup correctness.** For a synthetic 3-route project sharing one
   root layout: a changed leaf `+page.svelte` resolves to exactly that one
   route; a changed root `+layout.svelte` resolves to all three routes.
2. **Safe case, proven.** For a route-independent rule (SEO001), the verdict
   for route `/c` is byte-identical (`toEqual`) whether the rule is handed
   every route's heads or only `/c`'s head — confirming route-independent
   rules are genuinely safe to scope.
3. **Danger case, proven.** For SEO028 (duplicate-title detection) with `/a`
   and `/b` sharing the literal title "Same Title": the full-project run
   correctly flags `/a` as `duplicated across 2 routes` (`PENALIZED`). Scoping
   the same rule to only `/a`'s head (simulating "only the changed route was
   resolved") flips the verdict to `PASS` ("Unique title") — **a false pass**.
   This is not a hypothetical; it was executed and asserted
   (`expect(scopedForA).not.toEqual(fullForA)` passes).

Test run (executed in this session, 3/3 passing):

```
✓ reverse-lookup finds only the leaf page for a changed leaf file, but every page for a changed shared layout
✓ a route-independent rule (SEO001) gives an identical verdict whether or not sibling routes are included
✓ DANGER CASE — a cross-route rule (SEO028 duplicate title) silently under-reports when scoped to only the changed route
```

No fixture-scale timing benchmark is reported here: `packages/cli/test/fixtures/basic-project`
(the largest available CLI fixture) has only 9 routes — too small for a
meaningful wall-clock comparison. See "Estimated impact" below for a
complexity-based estimate instead of a measured one.

## Recommended approach (not yet implemented)

If a follow-up implementation plan is written, the shape this spike points to:

1. Add a `dataDependency: 'route' | 'component' | 'project-wide'` field to
   `Rule` (or an equivalent lookup table) so SEO028/SEO029 are explicit,
   type-checked opt-outs — never inferred from `Rule.scope`.
2. In `applyScope`'s callers (`analyzeProject`'s `--diff`/`--staged` path),
   when the changed-file set consists **only** of files that are literally
   `+page.svelte`/`+layout.svelte`/`+page@*.svelte`/`+layout@*.svelte` under
   `src/routes`, compute `affectedPages(...)` and:
   - resolve only those pages' routes/images/headings (skip `resolveRoute` for
     the rest),
   - run route-independent and component-scoped rules restricted to the
     affected routes/changed component files,
   - run cross-route rules (SEO028/SEO029) against the **full** project
     regardless — they need whole-project data no matter what changed, so
     there is no partial-analysis form of them worth building. (Their own
     cost is O(routes) over already-resolved heads, not proportional to
     parse work, so even the "safe" version of this optimization still pays
     for full head resolution for JUST these two rules — see Open Question 1.)
3. When the changed-file set includes anything else (a `$lib` component, a
   config file, `src/app.html`, etc.), fall back to full-project analysis —
   do not attempt the import-graph reverse lookup (Step 2, finding 2)
   without a separate design pass of its own.
4. `--baseline`'s second (base-ref) analysis is a full run of a **different**
   git ref's tree, where "changed files relative to what's currently
   analyzed" doesn't apply in the same way — Open Question 4 below.

## Open questions for the maintainer

1. **Does SEO028/SEO029 needing full heads defeat the point?** If those two
   rules alone force resolving every route's head regardless of what
   changed, is the win from skipping `resolveFileTags`'s transitive
   component walk for the *other* 34 route-independent rules still worth the
   implementation complexity? (Likely yes for projects with heavy meta
   components / deep transitive resolution, since head resolution itself —
   not the tiny SEO028/029 Map-building loop — is the expensive part; but
   this is a judgment call, not something this spike measured.)
2. **What is the fallback threshold?** "Any non-route/layout file → analyze
   everything" is simple and safe, but on a project whose PRs mostly touch
   `$lib` components (design-system-heavy apps), it would provide zero
   speedup in the common case. Is that an acceptable v1 scope, or does the
   import-graph approach (Step 2, finding 2) need its own design spike before
   this ships?
3. **Should `--update-suppressions` and `--score` interact with this at all?**
   They already ignore scoping flags for `--update-suppressions` (design doc
   `2026-07-13-suppressions-file-design.md`, decision 2) or use the full
   result set; no change implied here, but a future plan should confirm.
4. **Does `--baseline`'s second full analysis get the same treatment?** The
   baseline analysis diffs the *current* scoped results against a full
   analysis of the base ref. Applying the same route-scoping to the baseline
   run would require answering "which of the base ref's routes correspond to
   the changed files" — which may not even exist in the base ref (a brand
   new route). This spike's plan explicitly kept `checkoutBaseline`'s
   mechanism out of scope; a follow-up plan needs to decide whether the
   baseline run gets scoped too, or stays a full run (only the *primary*
   analysis benefits).
5. **Is a `dataDependency` field worth adding to the public `Rule` type**,
   given it's consumed only by the CLI's internal scoping logic and
   `@svelte-vitals/core` is meant to stay runtime-agnostic and mode-agnostic?
   An alternative is a CLI-local constant set (`CROSS_ROUTE_RULE_IDS = new
   Set(['SEO028', 'SEO029'])`) that doesn't touch core's `Rule` type at all —
   simpler, but drifts silently if a future rule needs the same treatment and
   nobody remembers to update the constant. A `core`-side field is
   self-documenting and enforced by the type checker at the rule's
   definition site.

## Estimated impact and effort (rough)

- **Impact is proportional to project size and how "route-independent-heavy"
  the diff is.** For a project with N routes where a `--staged` run touches
  one leaf page, skipping `resolveRoute` for the other N−1 routes turns the
  head-resolution cost from O(N) to O(1) route walks (plus the O(N) glob
  enumeration, which stays cheap). The bigger N is, and the deeper the
  component trees being newly-avoided are, the bigger the win — but this
  spike has no real-world-scale fixture to benchmark against (existing CLI
  fixtures max out at 9 routes), so no concrete "X% faster" number is
  claimed here. A follow-up implementation plan should benchmark against a
  synthetic large fixture (50-200 routes) before/after.
- **Effort for a full implementation**: M — the reverse-lookup helper itself
  is small (demonstrated above), but correctly wiring "which rules are safe
  to scope" through `analyzeProject`/`applyScope` without regressing
  SEO028/SEO029 (or any future cross-route rule) needs real test coverage
  proving the danger case from Step 3 can never happen in production, not
  just in a throwaway spike test. Expect most of the effort to be in tests,
  not the reverse-lookup logic itself.
