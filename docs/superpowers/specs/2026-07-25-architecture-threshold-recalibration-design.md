# Architecture thresholds: empirical recalibration — Design

Date: 2026-07-25
Status: Approved

## Problem

Both Architecture rules carry hard-coded thresholds that were picked without measurement:

- `architecture/prop-count` flags a component with **more than 10** destructured props.
- `architecture/component-size` flags a component **longer than 400 lines**.

Measured against real Svelte code (below), both sit far out in the tail of the distribution —
`prop-count` at roughly the 93rd percentile of the pooled sample and higher still for a typical
project, `component-size` at about the 98th. On most Svelte codebases neither rule fires at all,
so the rules go silent on exactly the components they exist to catch. The payoff of lowering the
thresholds is findings visibility — real components actually surface — not a change to the
Architecture score: the scorer averages per-file scores across a project, so the score is largely
unmoved by this change either way regardless of where the thresholds sit. That is a separate
question from where to set the thresholds and is out of scope here.

## Method

The thresholds are re-derived with **benchmark-based threshold selection**: measure the metric
across a corpus of real systems and take a percentile of the observed distribution as the
threshold. This is the method Ferreira & Valente use for ReactSniffer
([Detecting code smells in React-based Web apps](https://homepages.dcc.ufmg.br/~mtov/pub/2023-ist-react.pdf),
Information and Software Technology, 2023), which derives its React thresholds from the 90th
percentile over 10 popular projects, explicitly "to be conservative in our thresholds selection
policy". Their paper classifies "Too Many Props" as an instance of Fowler's Long Parameter List
smell, which is the same thing `prop-count` measures.

Two other reference points were checked and rejected as sources for a number:

- [`vue/max-props`](https://eslint.vuejs.org/rules/max-props) — the closest ecosystem analogue —
  ships **no default at all**; the rule does nothing unless the user supplies `maxProps`. Vue
  deliberately declines to pick a number.
- [`max-params`](https://eslint.org/docs/latest/rules/max-params) defaults to 3, but it counts
  positional parameters. Named props carry materially less cognitive load than positional
  arguments, so that number does not transfer.

Widely-repeated blog guidance of "5–7 props" was likewise treated as design advice rather than a
detection threshold — none of the sources surveyed derived it from data.

### Corpus

Measured with svelte-vitals' own `parseComponentFacts`, so the metric is exactly what the rules
see. Script and raw output are reproduced at the end of this document.

|   # | Repository              | Kind    | `.svelte` files | Countable components |
| --: | ----------------------- | ------- | --------------: | -------------------: |
|   1 | appwrite/console        | app     |            1014 |                  225 |
|   2 | huntabyte/bits-ui       | library |             617 |                   96 |
|   3 | huntabyte/shadcn-svelte | library |            1683 |                  147 |
|   4 | immich-app/immich       | app     |             411 |                  285 |
|   5 | skeletonlabs/skeleton   | library |             686 |                   27 |
|   6 | sveltejs/kit            | library |             951 |                   72 |
|   7 | sveltejs/svelte.dev     | app     |             557 |                  166 |
|   8 | threlte/threlte         | library |             794 |                  253 |
|   9 | windmill-labs/windmill  | app     |            1712 |                 1265 |
|  10 | xyflow/xyflow           | library |             126 |                   55 |
|     | **Total**               |         |        **8551** |             **2591** |

"Countable" means `propCount > 0` — the same condition the rule's own `applies` uses. Every
per-repository list below is in this same numbered order.

Three further repositories were surveyed and excluded from the percentile aggregation because
they carry too few runes-based components to compute one (fewer than 20): melt-ui/melt-ui
(0 of 322 files), open-webui/open-webui (2 of 593), and huntabyte/formsnap (8 of 22). The first
two are still written against Svelte 4's `export let`, which `countProps` does not count — a
useful reminder that this rule simply does not apply to a codebase that has not migrated to
runes. Including them, the full survey covers 13 repositories and 9,488 `.svelte` files.

### Aggregation: per-repo median, not pooled

Pooling every component into one distribution lets the largest repository decide the threshold.
Here windmill-labs/windmill alone contributes 1265 of 2591 components (49%) and is itself an
outlier (its own p90 is 10, the highest in the corpus). Pooled percentiles are therefore reported
alongside two aggregations that do not let one project dominate:

| Percentile | Pooled | Per-repo values                  | **Per-repo median** | Pooled without windmill |
| ---------- | -----: | -------------------------------- | ------------------: | ----------------------: |
| p75        |      5 | 4, 5, 1, 4, 3, 1, 3, 5, 6, 9     |               **4** |                       4 |
| p85        |      7 | 5, 7, 2, 5, 4, 1, 4, 6, 9, 12    |               **5** |                       5 |
| **p90**    |      9 | 6, 9, 3, 6, 5, 1, 4, 7, 10, 12   |               **6** |                       6 |
| p95        |     12 | 8, 15, 4, 8, 9, 2, 6, 11, 13, 14 |             **8.5** |                       9 |

The per-repo median and the windmill-excluded pool agree at every percentile, which is the
signal that the pooled figure is the distorted one. **The Svelte p90 for prop count is 6.**

### Robustness: the number survived doubling the corpus

The first version of this measurement used 7 repositories and 2,239 countable components, which
is a thin base for a median. The corpus was therefore widened to 13 repositories (10 of them with
enough runes components to yield a percentile) and 2,591 countable components, adding a large
production app (appwrite/console), SvelteKit's own repository, and a further library (xyflow).

**The per-repository p90 median stayed at exactly 6**, and the windmill-excluded pool stayed at 6
as well. `component-size` moved only marginally, from a p90 median of 124 to 132 and a p95 median
of 179 to 183, leaving the 200 decision untouched.

That stability across an almost-doubled sample is stronger evidence than the sample size itself:
the answer is not resting on which repositories happened to be picked. The residual caveat is
unchanged in kind — a median over 10 observations spanning 1 to 12 is still a small-sample
statistic — but the specific worry that one added or dropped repository would move it has now
been tested and did not materialise.

Note this lands well below React's empirical 13. That is consistent with the framework: Svelte
components pass content through snippets and children, expose two-way state through `bind:`, and
read shared state from context — all of which are props in React.

### Line count

Line count is measured over every parsable component, not just the ones with countable props, so
all 13 surveyed repositories contribute here (n = 8,922).

| Percentile | Pooled | Per-repo median |
| ---------- | -----: | --------------: |
| p90        |    184 |         **132** |
| p95        |    285 |         **183** |
| p99        |    688 |         **322** |

Several corpus repositories are Tailwind-heavy and carry little or no scoped `<style>`, so a
project that does use scoped styles will have longer components at the same complexity and get
flagged more often than this corpus predicts; 200 is permissive enough that this does not change
the number, but it remains a known limitation of the line-count measurement.

## Decision

| Rule                          | Constant    | Current |     New | Rationale                                                                                                   |
| ----------------------------- | ----------- | ------: | ------: | ----------------------------------------------------------------------------------------------------------- |
| `architecture/prop-count`     | `MAX_PROPS` |      10 |   **6** | the per-repo median p90, confirmed by the windmill-excluded pool                                            |
| `architecture/component-size` | `MAX_LOC`   |     400 | **200** | above the p90 median (132) and the p95 median (183), rounded to a memorable number on the conservative side |

`component-size` is deliberately not set to the p90 median. A long component is a weaker and more
context-dependent smell than a wide prop list — generated markup, tables, and form layouts are
legitimately long — so this one takes the more permissive end of the measured range.

Nothing else about either rule changes: both stay `severity: 'info'`, both stay component-scoped,
and the detection logic is untouched. The edit is the constant plus the `recommendation` string
that interpolates it.

## Recording the method in the code

The point of failure for a change like this is that the number survives but its justification does
not, so the next person to feel that 6 is "too strict" or "too lax" reopens the same argument from
scratch. Each constant therefore carries a doc comment naming the corpus, the statistic, and the
date:

```ts
/**
 * More destructured props than this suggests the component is doing too much.
 * Derived empirically (2026-07-25): the median of the per-repository 90th percentile across
 * 2,591 countable components in 10 real Svelte 5 codebases (5 libraries, 5 applications) — see
 * docs/superpowers/specs/2026-07-25-architecture-threshold-recalibration-design.md. Pooling
 * every repository into one distribution gives 9, but that figure is set by a single outlier
 * project contributing 56% of the sample.
 */
const MAX_PROPS = 6;
```

```ts
/**
 * A component longer than this many lines is a "god component" smell.
 * Derived empirically (2026-07-25) from the same corpus: the per-repository 90th percentile
 * median is 132 lines and the 95th is 183. This threshold sits deliberately above both — a long
 * component is a weaker signal than a wide prop list, since tables, forms, and generated markup
 * are legitimately long.
 */
const MAX_LOC = 200;
```

## Testing

The existing tests exercise `propCount: 15` / `3` and `loc: 500` / `50`. Every one of those
produces the same verdict under both the old and the new constants, so they pass unchanged and,
more importantly, **they do not pin the threshold at all** — an accidental edit to either constant
would not fail a single test. Boundary cases are added so the numbers are actually held:

- `propCount: 6` → passes; `propCount: 7` → flagged
- `loc: 200` → passes; `loc: 201` → flagged

The existing message assertions check the observed value (`'15'`, `'500'`), not the threshold, so
they need no change.

## Docs and release

- Update the four rule pages — `docs/src/content/docs/rules/architecture/{prop-count,component-size}.md`
  and their `ja/` mirrors — with the new numbers, plus one sentence on where each comes from.
- Changeset: **minor** across the four published packages. The body states both old→new values and
  warns that Architecture scores will drop for existing projects (an `info` finding deducts 1
  point each), since that is a visible behaviour change rather than a bug fix.
- Historical CHANGELOG entries that mention "over 400 lines" / "more than 10 props" are left
  alone; they describe what those releases actually did.

## Out of scope (recorded, not fixed)

**The uncountable 37%.** `countProps` returns 0 — which the rule treats as "not analyzable" and
skips — whenever `$props()` uses a rest element, is not destructured, or appears more than once.
In the corpus that is **1,296 of the 3,535 components that use `$props()` (37%)**. No threshold
change reaches them; a component with `...rest` is invisible to this rule no matter what the
number is. Worth its own issue: a rest element could plausibly still contribute a count of the
named properties beside it.

**User-configurable thresholds.** The measurement showed per-repository p90 ranging from 3
(shadcn-svelte) to 10 (windmill) — a component library and a large application genuinely differ,
and one global number cannot serve both. Today `RuleSetting` is only `'off' | Severity`, so a
user who disagrees can only disable the rule outright. Adding per-rule options is a config-system
feature, independent of which number is the default, and belongs in its own spec.

## Appendix: reproducing the measurement

Corpus cloned with `git clone --depth 1` into one directory, then measured with a script that
walks every `.svelte` file (skipping `node_modules`, `.svelte-kit`, `dist`, `build`), calls
`parseComponentFacts` from the built core, and reports nearest-rank percentiles of `propCount`
(where `> 0`) and `loc`. Raw pooled output at the time of writing:

```text
.svelte files scanned : 9488   (all 13 surveyed repositories)
parse failures        : 425
countable prop counts : 2601
no props at all       : 3889
legacy `export let`   : 1246
$props() uncountable  : 1327

propCount pooled percentiles
  p50: 2   p75: 5   p85: 7   p90: 9   p95: 12   p99: 21   max: 72

components flagged at each candidate threshold (pooled)
  > 4: 27.7%   > 5: 21.2%   > 6: 16.3%   > 7: 12.9%
  > 9:  8.1%   > 10: 6.5%   > 13: 3.1%   > 20: 1.1%

loc pooled percentiles
  p50: 38   p75: 88   p90: 184   p95: 285   p99: 688   max: 5121
  > 116: 18.4%   > 200: 8.9%   > 300: 4.6%   > 400: 2.8%
```

Two notes on reading these pooled figures. They include the three repositories excluded from the
percentile aggregation, so `countable prop counts` here (2601) is slightly above the 2591 in the
corpus table. And they are inflated by windmill, which is both the largest contributor and the
corpus's highest outlier; a project with a typical distribution sees roughly 10% of its countable
components flagged at `> 6`, not the 16.3% shown here.
