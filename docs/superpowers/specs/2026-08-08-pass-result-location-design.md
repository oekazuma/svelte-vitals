# PASS-result `location` convention — design spike

Date: 2026-08-08
Status: Accepted (2026-08-08, maintainer approval); amended 2026-08-08: blast-radius expanded
to the full PASS-emitter set; unit-entry-file route-less-pass carve-out.

## Problem

Issue [#382](https://github.com/oekazuma/svelte-vitals/issues/382): a `files:`-scoped
`severity: 'off'` override silently fails to remove the _passing_ seed of three rules —
`seo/title-length`, `seo/description-length` (both built by `lengthRule` in
`packages/core/src/rules/seo/length-rule.ts`), and `performance/preconnect`
(`packages/core/src/rules/perf/preconnect.ts`) — while it correctly removes their penalized
findings.

The mechanism is `applyOverrides` in `packages/core/src/config-apply.ts`. Its doc comment states
the contract:

> `'off'` removes a matched result entirely — passing seeds included, so scoring and "checks
> passed" counts behave as if the rule never ran there.

But the matcher it relies on, `overrideMatches`, can only match a `files:` glob against a result
that carries `location`:

```ts
export function overrideMatches(o: CompiledOverride, target: { route?: string; file?: string }): boolean {
  const { route, file } = target;
  return (
    (route !== undefined && o.routes.some((p) => p.test(route))) ||
    (file !== undefined && o.files.some((p) => p.test(file)))
  );
}
```

and `applyOverrides` builds `target` as `{ route: result.route, file: result.location }`. The
three rules above emit a PASS result with `route` but no `location`:

```ts
// packages/core/src/rules/seo/length-rule.ts, the PASS branch
: {
    id: opts.id,
    category: 'seo',
    severity: 'info',
    detection: PASS,
    route: head.route,
    message: opts.label,
    recommendation,
    docsUrl
  }
```

so `file` is `undefined`, the `files:` condition is never true, and the PASS result survives
`applyOverrides` untouched. `route:`-scoped overrides are unaffected — `route` is always set.

### Reproduction (from the issue)

Two routes, one passing and one failing `seo/title-length`:

- `files:`-scoped `'off'` on the passing route's file → silent no-op (score 98, seed survives).
- `route:`-scoped `'off'` on the same route → works (score 96, seed removed).
- `files:`-scoped `'off'` on the _failing_ route's file → works (score 100, that result carries
  `location`).

### Docs overpromise

`docs/src/content/docs/guides/(setup)/configuration.mdx` states `'off'` "removes matching
findings entirely — they don't fail the run and don't drag the score, as if the rule hadn't run
there," and its first `overrides` example is `{ files: 'src/routes/(app)/**', rules: { seo: 'off' } }`
— exactly the shape that leaves these three rules' (and, as this spike found, several others')
pass seeds counted. A caveat documenting the limitation ships in the configuration guide (en and
ja) alongside this document; it does not fix the underlying gap, only stops the guide overpromising.

### Why the obvious fix was reverted

Commit `e67ed9a` (dangling — not on any branch, reachable only via `git reflog`) added `location`
to these three rules' PASS branches. It was reverted in `74d9128` (also dangling) after review
found two CLI consumers that read `.location` on **all** results, not just penalized ones, and
both broke:

- `filterToChangedFiles` (`packages/cli/src/changed-files.ts:54-56`) — its own doc comment says
  "Results without a `location` (project-scoped findings, passing seeds) are dropped." Giving the
  three rules a `location` made them the _only_ PASS-emitting rules with one, so they alone
  survived `--diff`/`--staged` filtering. Verified regression: a changed set of two files (one
  critical `correctness` finding, one `seo/title-length` PASS) moved Health from **79 to 90**
  purely from the added `location`; `--min-health 85` flipped fail → pass.
- `findingKey` (`packages/cli/src/baseline.ts:19-21`) is `` `${id}::${route ?? ''}::${location ?? ''}` ``.
  Adding `location` to a PASS result makes its key collide with the penalized result for the same
  rule/route/file (previously `id::route::` for PASS could never collide, because no penalized
  result has an empty `location`).

The revert recorded the deferral in `docs/superpowers/specs/2026-07-26-rule-options-design.md`
("Out of scope" section), including the sentence this spike exists to resolve:

> Which PASS results carry a location is currently inconsistent, and that is the real problem
> here.

This spike is that follow-up.

## The convention decision

Two options were evaluated.

### Option (a) — uniform attribution

Every PASS result carries the same `location` its penalized counterpart would, and every consumer
that reads "`location` absent" as "passing seed" switches to an explicit `detection`-based check.

### Option (b) — no PASS location, with a `route` fallback

No PASS result ever carries `location` (including `headTagRule` and `seo/title-presence`, which do
today), and `overrideMatches` gains a fallback so `files:` can match a PASS result some other way —
e.g. against `route` when `location` is absent.

**Recommendation: (a).**

The inconsistency is already broad, not narrow to the three named rules. Grepping
`detection: PASS` (plus `performance/preconnect`'s equivalent inline
`{ presence: 'own', value: 'static' }`, which the literal string misses because it doesn't import
the named `PASS` constant) across `packages/core/src/rules/` turns up 13 call sites, and two of
them are factories shared by many rule ids (see Blast radius). Only two call sites —
`head-tag-rule.ts` and `title-presence.ts` — already set `location` unconditionally. So "no
location means passing" is _already_ false for those two, and option (a) simply extends the
convention they already use to everyone else, rather than walking it back.

Option (b) is unsound for the majority of the affected rules. `overrideMatches`'s `route`
parameter means different things depending on `Rule.scope`:

- For `scope: 'component'` rules (built by `componentRule`/`kitModuleRule`), `route` **is already
  a file path** — `componentRule`'s own doc comment says "Findings use the source file as the
  scoring unit (`route` + `location` = file)" (`packages/core/src/rules/component-rule.ts:41-45`).
  A `files:`-glob-against-`route` fallback would work here.
- For `scope: 'route'` rules (`lengthRule`, `preconnect`, `headTagRule`, `title-presence`,
  `heading-level-skip`, `hreflang`, the JSON-LD family, `single-h1`, `uniqueness-rule` — the
  majority of PASS-emitting rules), `route` is a SvelteKit route id like `/blog/[slug]`, not a
  path. The configuration guide itself documents why `files:` exists as a _separate_ scope from
  `route:`: "SvelteKit `(group)` segments are not part of the route id (`src/routes/(app)/dashboard`
  reports as `/dashboard`) — to target a group, use `files`." A route id and a source path are
  different vocabularies; matching a `files:` glob against a route id would silently misbehave for
  any project using route groups, which is precisely the case the guide's own first example
  targets (`files: 'src/routes/(app)/**'`).

So option (b)'s fallback would need to be conditional on `Rule.scope`, is unsound for route-scoped
rules (the more common case and the one the issue is actually about), and additionally regresses
the two rules that already do the right thing today. Option (a) has one shape, works uniformly,
and each PASS branch it touches already computes the value it needs — the revert's own commit
message notes the fix "reuses a value already computed on the penalized branch."

## Consumer redefinitions (under option (a))

Both redefinitions below use `isPenalized` (`packages/core/src/rule.ts:73-78`), already exported
from core and already the pattern `packages/cli/src/suppressions.ts` uses — `applySuppressions`
and `writeSuppressions` both gate on `isPenalized(r.detection, config.treatDynamicAs)` before ever
building a key (`packages/cli/src/suppressions.ts:104`, `:136`). `baseline.ts`'s
`filterToNewFindings` is the one CLI consumer that does _not_ already follow this pattern — that
asymmetry is the direct cause of the collision this spike is fixing.

### `filterToChangedFiles`

Current (`packages/cli/src/changed-files.ts:54-56`):

```ts
export function filterToChangedFiles(results: Result[], changed: Set<string>): Result[] {
  return results.filter((r) => r.location !== undefined && changed.has(r.location));
}
```

**The 79 → 90 flip, and which number is correct.** `applyScope`'s output feeds `computeHealth`
(`packages/cli/src/index.ts:479-495`), which buckets results by category and scores each
independently (`scoresByCategory` in `packages/core/src/scoring/score.ts:142-158`), then averages
only the categories _present_ in the filtered set. In the reproduction, before the revert the
`--diff` filtered set held only the `correctness` critical finding — `seo` had zero results, so it
was absent from the average entirely, and Health equaled the `correctness` category's own capped
score, 79 (`CRITICAL_CAP = 79`, `packages/core/src/scoring/score.ts:9`, `:129-131`). After adding
`location`, the `seo/title-length` PASS survived filtering too, making `seo` _present_ with a
perfect 1-route, zero-deficit score of 100 — averaging a real 79 against a fabricated 100 pulls
Health up. This spike re-ran the mechanism directly against `computeHealth` (one critical
`correctness` finding plus, in the "after" case, one `seo/title-length` PASS, `defineConfig({})`):
the minimal case here floors to 79 → **89**, not the commit message's 90 — the commit's own fixture
evidently held one or two more findings than this minimal reconstruction, and the exact figure
depends on fixture details this spike did not have access to (the tests that pinned it were
deleted by the revert). The _mechanism_ — a category flips from absent to a fabricated 100 and
pulls the weighted average up — reproduces exactly regardless of the precise figure; only the
magnitude is fixture-dependent. A characterization test (below) should pin the real number before
this spike's fix lands, from a fixture the maintainer can reconstruct or point to.

**79 is correct; 90 is the bug.** A `--diff` gate answers "did this change introduce a problem,"
scoped to what changed. One incidental passing `seo/title-length` check on one file says nothing
about the `seo` category's overall health — most of `seo` (everything on unchanged files) is
invisible to `--diff` by construction. Letting a single passing seed promote an entire category
from _absent_ to _perfect_ inflates the headline number in a way the gate's own purpose forbids:
it would let a PR that fixes nothing and happens to touch a file with one unrelated passing check
raise Health. This is not specific to the three named rules — it is exactly the same shape of bug
for any rule, which is why `headTagRule`/`title-presence`'s PASS results (which _already_ carry
`location` today) already leak into `--diff` in a way the doc comment's stated intent
("the gate reports issues in the changed files") does not endorse. That is a **pre-existing,
undetected instance of the same bug** for those eleven rule ids (see Blast radius and the
`findingKey` section below, which verifies the same live-today bug independently for
`--baseline`), not a new one option (a) introduces.

**Recommendation:** redefine `filterToChangedFiles` to explicitly drop every ROUTE-CARRYING passing
seed, regardless of `location`, and keep only penalized findings (or a route-less PASS — see the
"unit-entry-file exception" below) whose `location` is in the changed set:

```ts
export function filterToChangedFiles(
  results: Result[],
  changed: Set<string>,
  config: Config = defaultConfig
): Result[] {
  return results.filter(
    (r) =>
      r.location !== undefined &&
      changed.has(r.location) &&
      (isPenalized(r.detection, config.treatDynamicAs) || r.route === undefined)
  );
}
```

This restores 79 for the reproduction (no category is ever promoted to "present" by a bare
route-carrying PASS), and additionally _fixes_ the latent leak for `headTagRule`/`title-presence`
today — a behavior change for those eleven rule ids under `--diff`/`--staged` specifically, which
needs its own characterization test (below) and a changeset callout, since it can move a reported
`--diff` Health number downward for existing users relying on the current (arguably accidental)
leak. Measured on the minimal reproduction (one critical `correctness` finding plus one
`headTagRule`-backed PASS, both in the changed set, `defaultConfig`): 89 → 79, confirming this
spike's own earlier note that the minimal case floors to 89, not the original bug report's 90.

**The `architecture/unit-entry-file` exception (maintainer ruling, 2026-08-08).** This spike's
initial blast-radius pass missed that `architecture/unit-entry-file.ts` already emits a
route-less, location-carrying PASS per conforming unit (PR #337, "make a displayed score of 100
mean zero findings") — deliberately, so that pass stays visible under `--diff` when its entry file
changes (`packages/cli/test/changed-files.test.ts`, "spec testing item 7"). A blanket
`isPenalized`-only redefinition would silently reverse that shipped decision and fail the pinned
test. This PASS is score-inert in **both** directions: `computeScore`'s per-category denominator
is seeded from `route`, and this result never carries one (that omission is PR #337's own fix), so
the "a bare PASS fabricates a 100 and inflates the category average" mechanism above cannot apply
to it — there is no category to promote, in this direction or the reverse. The redefinition above
therefore keeps a PASS unconditionally when `route === undefined`, and drops one unconditionally
when `route` is present (the general case, including the three rules named in this spike). No
other current PASS-emitting rule is route-less — `unit-entry-file` is the sole beneficiary of this
clause today.

### `findingKey` / `filterToNewFindings`

Current (`packages/cli/src/baseline.ts:19-21`, `:74-77`):

```ts
export function findingKey(r: Pick<Result, 'id' | 'route' | 'location'>): string {
  return `${r.id}::${r.route ?? ''}::${r.location ?? ''}`;
}

export function filterToNewFindings(results: Result[], baselineResults: Result[]): Result[] {
  const baselineKeys = new Set(baselineResults.map(findingKey));
  return results.filter((r) => !baselineKeys.has(findingKey(r)));
}
```

Should a PASS result ever enter baseline comparison at all? Walk the three cases for one
route/rule across a baseline → current transition, under today's (no-location) keys:

1. **Unchanged, still passing.** Baseline key `id::route::`, current key `id::route::` — same key,
   current is dropped by `filterToNewFindings` today. Already correct: an unchanged pass isn't a
   new finding.
2. **Improved (baseline PENALIZED → current PASS).** Baseline key `id::route::file`, current key
   `id::route::` — different keys, current's PASS **survives** `filterToNewFindings` today and
   stays in the output.
3. **Regressed (baseline PASS → current PENALIZED).** Baseline key `id::route::`, current key
   `id::route::file` — different keys, current's penalized finding correctly surfaces as new.

Now add `location` uniformly (option (a)) **without** touching `findingKey`. Case 1 is unaffected
(both sides still share one key, just a longer one). Cases 2 and 3 both become the _same_ key on
both sides — `id::route::file` — because a PASS and a PENALIZED result for the same route now
carry identical `location`. Both collide, and both bugs are real, in opposite and asymmetric
severity:

- **Case 2 collides → the current PASS is dropped**, matching what the revert commit's own words
  describe ("a route fixed on the branch could lose its passing seed") — a lost passing seed,
  cosmetic on its own.
- **Case 3 collides → the current penalized finding is dropped**, because it now matches the
  baseline's (differently-detected) key — `--baseline` would silently treat a genuine regression
  as "not new" and never surface it. This direction is strictly worse than case 2: it is a false
  negative on the primary thing `--baseline` exists to catch.

**Case 3 is not hypothetical — it is live in the shipped CLI today, for every rule that already
sets `location` unconditionally.** `headTagRule` (`packages/core/src/rules/seo/head-tag-rule.ts:53-66`)
builds one result object shared by both the PASS and PENALIZED paths, and `location: head.file` is
set on it unconditionally — the same is true of `seo/title-presence`
(`packages/core/src/rules/seo/title-presence.ts:44-57`), built independently but with the identical
shape (`location: head.file` outside any pass/fail branch). Grepping every `headTagRule(` call site
gives the full list of rule ids sharing this factory: `seo/canonical-url`, `seo/og-image`,
`seo/og-title`, `seo/charset`, `seo/og-description`, `seo/twitter-card`, `seo/viewport`,
`seo/description-presence`, `seo/json-ld`, `seo/og-url` — ten rule ids, plus `seo/title-presence`,
eleven total. For every one of these eleven rule ids, a route that passed at the baseline ref and
now fails (e.g. a `<title>` deleted from a route that had one, a canonical URL removed) produces a
baseline key `id::route::file` and a current key `id::route::file` — identical, because both
branches of these rules always carry the same `location`. `filterToNewFindings` drops the current
result as "already existed," and `--baseline` silently reports no regression. This is today's
actual behavior, verified against the source above, not a projection of what option (a) would
cause — option (a) would only extend the same live bug to the remaining rules that don't have it
yet.

**Sequencing.** Because this collision already exists for eleven rule ids independent of anything
in this spike, the `filterToNewFindings`/`findingKey` redefinition below is not gated on the
convention decision, on option (a) shipping, or on this document being accepted — it is a
standalone bug fix the maintainer can take immediately, ahead of and separately from the rest of
this spike. The rest of this document (the PASS-`location` convention, the `filterToChangedFiles`
redefinition, the blast radius) still stands on its own as the follow-up that decides how PASS
results are attributed everywhere else.

`findingKey`/`filterToNewFindings` needs this fix regardless — live today for the eleven
already-located rule ids, and case 3 alone would make it non-optional the moment option (a) extends
`location` to the rest. The fix: filter both `results`
and `baselineResults` to penalized-only _before_ building any key, mirroring the pattern
`suppressions.ts` already uses (`applySuppressions`/`writeSuppressions` both gate on `isPenalized`
before calling `findingKey`). A PASS result never becomes a key on either side, so it can never
collide with a PENALIZED one in either direction:

```ts
export function filterToNewFindings(results: Result[], baselineResults: Result[], config: Config): Result[] {
  const penalized = (rs: Result[]) => rs.filter((r) => isPenalized(r.detection, config.treatDynamicAs));
  const baselineKeys = new Set(penalized(baselineResults).map(findingKey));
  return penalized(results).filter((r) => !baselineKeys.has(findingKey(r)));
}
```

Re-running the three cases against this definition: case 1 stays dropped (never a candidate on
either side). Case 3 now surfaces correctly, unconditionally — the baseline PASS never enters
`baselineKeys`, so the current regression can't be masked by it. **Case 2 changes from today's
behavior**: the improved route's PASS no longer appears in `filterToNewFindings`'s output at all
(it is penalized-filtered out on the `results` side before keying), where today it survives. This
is a real, user-visible delta from current `--baseline` behavior, but it is not a new one this
redefinition introduces — it is the same outcome case 2 already gets by accident the moment
`location` is added under option (a), just reached deliberately instead of by key collision.
Whether an improved route's PASS should still reach `computeHealth` under `--baseline` (seeding
that route at 0 deficit) is a real design question, but it is a _scoring_ question — this filter
correctly stops treating a passing result as "a finding to report new/not-new" either way, and
scoring downstream of `applyScope` never distinguished `--baseline`-observed passes from any
other pass to begin with.

**Does the key need `detection`?** No. Once both sides are pre-filtered to penalized-only, every
result the key is built from is penalized by construction — `detection` would never discriminate
between two keyed results, so adding it is state the key doesn't need. Keep `findingKey`'s
signature and format unchanged; only the two call sites change to filter first.

## Blast radius

**Amendment (2026-08-08, post-acceptance):** the table below originally came from grepping
`detection: PASS` plus one named carve-out for `performance/preconnect`'s literal-object
equivalent (`{ presence: 'own', value: 'static' }`), which the string grep misses because it
doesn't import the named `PASS` constant. That carve-out was itself incomplete — `preconnect` is
not the only rule using an uncaught inline literal instead of the shared constant. The executor
implementing this spike found five more such files during characterization (`perf/lcp-image.ts`,
`perf/render-blocking-script.ts`, `perf/link-rule.ts`, `perf/image-rule.ts`,
`architecture/private-scope-import.ts`, backing 9 rule ids), verified each against live source,
and the maintainer ruled they belong in the same convention — the table below is the corrected,
complete enumeration. The construction method going forward: grep both `detection: PASS` **and**
`presence: 'own', value: 'static'` (the two ways a PASS-shaped `Detection` literal appears) across
`packages/core/src/rules/`.

| File                                   | Location in PASS today                                                                 | Rule id(s) it backs                                                                                                                                                                                                        |
| -------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `seo/head-tag-rule.ts`                 | **yes** (unconditional)                                                                | `seo/canonical-url`, `og-title`, `og-image`, `charset`, `viewport`, `twitter-card`, `description-presence`, `og-description`, `json-ld`, `og-url`                                                                          |
| `seo/title-presence.ts`                | **yes** (unconditional)                                                                | `seo/title-presence`                                                                                                                                                                                                       |
| `architecture/unit-entry-file.ts`      | **yes** (route-less; see the `filterToChangedFiles` "unit-entry-file exception" below) | `architecture/unit-entry-file`                                                                                                                                                                                             |
| `seo/length-rule.ts`                   | no                                                                                     | `seo/title-length`, `seo/description-length`                                                                                                                                                                               |
| `perf/preconnect.ts`                   | no                                                                                     | `performance/preconnect`                                                                                                                                                                                                   |
| `component-rule.ts`                    | no                                                                                     | 20 rule ids across `security`, `correctness`, `architecture`, `performance` (e.g. `correctness/each-key`, `architecture/prop-count`, `security/raw-html`, `perf/heavy-import` — every rule built via `componentRule(...)`) |
| `kit-module-rule.ts`                   | no                                                                                     | `security/shared-state-import`, `security/server-module-state`, `security/handler-state-write`, `performance/load-waterfall`, `performance/sequential-awaits`, `seo/ssr-disabled`                                          |
| `seo/jsonld-engine.ts`                 | no                                                                                     | `seo/json-ld-date-format`, `json-ld-placeholder`, `json-ld-deprecated-type`, `json-ld-relative-url`, `json-ld-required-props`                                                                                              |
| `seo/json-ld-validity.ts`              | no                                                                                     | `seo/json-ld-validity`                                                                                                                                                                                                     |
| `seo/heading-level-skip.ts`            | no                                                                                     | `seo/heading-level-skip`                                                                                                                                                                                                   |
| `seo/hreflang.ts`                      | no                                                                                     | `seo/hreflang`                                                                                                                                                                                                             |
| `seo/single-h1.ts`                     | no                                                                                     | `seo/single-h1`                                                                                                                                                                                                            |
| `seo/uniqueness-rule.ts`               | no                                                                                     | `seo/duplicate-title`, `seo/duplicate-description`                                                                                                                                                                         |
| `correctness/base-path-navigation.ts`  | no                                                                                     | `correctness/base-path-navigation`                                                                                                                                                                                         |
| `correctness/orphan-lifecycle.ts`      | no                                                                                     | `correctness/orphan-lifecycle`                                                                                                                                                                                             |
| `correctness/server-browser-global.ts` | no                                                                                     | `correctness/server-browser-global`                                                                                                                                                                                        |
| `perf/lcp-image.ts`                    | no (added below)                                                                       | `performance/lcp-image`                                                                                                                                                                                                    |
| `perf/render-blocking-script.ts`       | no (added below)                                                                       | `performance/render-blocking-script`                                                                                                                                                                                       |
| `perf/link-rule.ts`                    | no (added below)                                                                       | `performance/font-preload-crossorigin`, `performance/preload-missing-as`                                                                                                                                                   |
| `perf/image-rule.ts`                   | no (added below)                                                                       | `performance/image-dimensions`, `performance/image-loading-hint`, `performance/responsive-image`, `seo/image-alt`                                                                                                          |
| `architecture/private-scope-import.ts` | no (added below)                                                                       | `architecture/private-scope-import`                                                                                                                                                                                        |

Project-scoped rules (`seo/robots-txt`, `sitemap-xml`, `html-lang`, etc.) are excluded: `route` is
undefined for them, `overrides` never applies to them ("Findings that aren't attached to a route
or file ... are never affected" — configuration guide), and `filterToChangedFiles`/`findingKey`
already drop them via the same "no `location`" path this spike is replacing, correctly, by design.

**Under option (a):** every row above except the first three gains a one-line `location:` addition
to an existing object literal. Where the surrounding function already computes the exact value the
penalized branch uses (`length-rule`, `hreflang`, `uniqueness-rule`, `component-rule`,
`kit-module-rule`, `jsonld-engine`, `json-ld-validity`, the three `emitFile`-shaped correctness
rules, `lcp-image`, `private-scope-import`), the PASS branch reuses it — the same pattern the
reverted `e67ed9a` used for the two rules it touched. Three rows have no such value to reuse,
because their PASS branch covers many items at once with no single winning one (`preconnect`,
`render-blocking-script`, `link-rule`) or their fact channel carries no route-level file at all
unlike `ResolvedHead.file` (`heading-level-skip`, `single-h1`, `image-rule`, which read
`ResolvedHeadings`/`ResolvedImages` instead of `ResolvedHead`); for those, the uniform attribution
is the route's own representative file — `head.file` where a `ResolvedHead` is in scope
(`preconnect`, `render-blocking-script`, `link-rule`), or the first item in the per-route array
otherwise (`route.headings[0].file` for `heading-level-skip`, `h1[0].file` for `single-h1`,
`route.images[0].file` for `image-rule`) — reasoning: a pass seed's `location` exists so a
`files:` glob can target the ROUTE's pass; per-tag/per-item penalized locations remain per-tag/item
regardless. No rule's `id`, `severity`, or `detection` changes — only which results become
matchable by `files:`.

**Score-visible effects:** none for CLI reports without `--diff`/`--staged`/`--baseline` — `score.ts`
never reads `location`, confirmed by the revert commit's own audit note ("scoring/*.ts never reads
`location`"). Effects are confined to (1) `overrides`' `files:` scope now reaching PASS results for
every rule in the table, matching the documented contract, and (2) the `--diff`/`--baseline`
redefinitions above.

**Suppressions-file key stability:** unaffected. `packages/cli/src/suppressions.ts` already builds
`SuppressionEntry`/keys only from penalized results (`writeSuppressions` line 104, `applySuppressions`
line 136 both gate on `isPenalized` before calling `findingKey`), so adding `location` to PASS
results changes nothing there — a PASS result was never eligible to become a suppression entry or
match one.

**Action-repo consumers:** `AGENTS.md` notes the GitHub Action (a separate repository) depends on
the published `svelte-vitals`/`@svelte-vitals/core` packages and bundles `applyScope`. It inherits
whatever `filterToChangedFiles`/`findingKey` do once those packages are bumped; this spike doesn't
inspect that repo's source, but the Action's `--diff`-mode PR comments would show the corrected
(lower, in cases like the reproduction) Health number after upgrading. Flag in the changeset body
so the Action's own changelog/README can note it if relevant — out of scope for this repo to fix
directly.

## Test plan

**Regression test (the issue's reproduction).** In `packages/core/test/config-apply.test.ts` (or
wherever `applyOverrides` is currently tested): two routes, one passing and one failing
`seo/title-length`; assert a `files:`-scoped `'off'` on the passing route's file removes that PASS
result (currently it does not). Mirror for `performance/preconnect`. A CLI-level test asserting a
`--diff` fixture's Health does not move when an out-of-category passing seed newly survives
filtering (the mechanism behind the reported 79 → 90 flip) belongs in
`packages/cli/test/changed-files.test.ts` or `packages/cli/test/index.test.ts` — pin the exact
before/after numbers from whatever fixture the test uses, rather than assuming 79/90 specifically.

**Characterization tests to write BEFORE touching any source** (pin current behavior so the diffs
above are provably intentional, not accidental):

1. `seo/title-length` / `seo/description-length` / `performance/preconnect` PASS results carry no
   `location` today — already pinned by the tests the `74d9128` revert added
   (`packages/core/test/seo-length-rules.test.ts`, `packages/core/test/perf-loading-rules.test.ts`);
   confirm they still exist and pass before starting.
2. `headTagRule`-backed rules and `seo/title-presence` PASS results already carry `location` today
   — add a test if none exists pinning this, since option (a) leaves their emission unchanged and
   only the _consumers_ change around them.
3. `filterToChangedFiles` today keeps a `headTagRule`-backed PASS result whose `location` is in the
   changed set (the latent leak) — pin this **before** the fix, so the test that replaces it
   documents the behavior actually changing and why.
4. `findingKey` today never collides a PASS with a PENALIZED result for the three unlocated rules
   (key is `id::route::` vs `id::route::file`) — pin this as the "before" state the fix must not
   regress into a new collision anywhere else.
5. A regression against `--baseline` for one of the **three unlocated** rules (baseline PASS,
   current PENALIZED, same route/file) surfaces correctly today via `filterToNewFindings` — pin
   this explicitly **before** adding `location`, since option (a) alone (without redefining
   `findingKey`) would make this collide and the regression would go unreported. This is the
   case-3 scenario in the Consumer redefinitions section.
6. **The same case-3 scenario for a `headTagRule`-backed rule id (e.g. `seo/title-presence` or
   `seo/canonical-url`) is expected to FAIL today.** Baseline: the route has a `<title>` (PASS,
   `location` set). Current: the same route's `<title>` was deleted (PENALIZED, same `location`).
   `filterToNewFindings(current, baseline)` should surface the regression but today drops it,
   because both results key to `id::route::file` identically. Write this test to assert the
   correct (post-fix) behavior and confirm it fails against the current `findingKey` — this is the
   live bug the Sequencing note above describes, and unlike item 5 it needs no source change to
   any rule to reproduce; it is already reachable through today's `headTagRule` output.
7. `applySuppressions`/`writeSuppressions` already ignore PASS results regardless of `location` —
   pin this so the spike's claim that suppressions are unaffected is a checked fact, not an
   assertion.

**After the change**, extend 1–2 above to assert `location` is now present and equals the
penalized branch's value (reusing the revert's deleted `e67ed9a` tests is reasonable — they
already exist in that dangling commit and can be cherry-picked or reconstructed), and add the
`filterToChangedFiles`/`findingKey` redefinition tests described in the Consumer redefinitions
section.

## Out of scope / open questions

- **Which PR actually implements this.** Resolved: implemented in the same PR that fixed this
  document's Status to Accepted (fix/382-pass-location-uniform).
- **Whether `filterToChangedFiles`'s signature change (`+ config`) is acceptable.** Resolved:
  threaded through as an optional parameter defaulting to `defaultConfig`, mirroring
  `filterToNewFindings` in `baseline.ts` — consistent within the same module family. Its one call
  site (`packages/cli/src/index.ts`, `applyScope`) has `opts.config` available and passes it.
- **Whether the `--diff`/`--staged` Health drop for `headTagRule`-backed rules (item 3 above) needs
  its own changeset entry distinct from the `files:`-override fix**, since it's a behavior change
  users could plausibly notice even though it's a bug fix, not a new limitation. Resolved: yes,
  named explicitly in the `svelte-vitals` changeset (measured 89 → 79 on the reference shape).
- **The Action repo's own release cadence** relative to this fix — not this repo's call to make.
  Still open; flagged in the changeset body per the Blast radius section above.
- **Whether `overrideMatches`/`applyOverrides` should eventually be taught to prefer `location` but
  fall back to treating `scope: 'component'` rules' `route` as a path** (a narrower, sound version
  of option (b)'s idea) as a _defense in depth_ alongside option (a) — deferred; option (a) alone
  closes the issue without it.
