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
so the Architecture category contributes almost nothing to a project's health signal.

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
|   1 | huntabyte/bits-ui       | library |             617 |                   96 |
|   2 | huntabyte/shadcn-svelte | library |            1683 |                  147 |
|   3 | immich-app/immich       | app     |             411 |                  285 |
|   4 | skeletonlabs/skeleton   | library |             686 |                   27 |
|   5 | sveltejs/svelte.dev     | app     |             557 |                  166 |
|   6 | threlte/threlte         | library |             794 |                  253 |
|   7 | windmill-labs/windmill  | app     |            1712 |                 1265 |
|     | **Total**               |         |        **6460** |             **2239** |

"Countable" means `propCount > 0` — the same condition the rule's own `applies` uses. Every
per-repository list below is in this same numbered order.

### Aggregation: per-repo median, not pooled

Pooling every component into one distribution lets the largest repository decide the threshold.
Here windmill-labs/windmill alone contributes 1265 of 2239 components (56%) and is itself an
outlier (its own p90 is 10, the highest in the corpus). Pooled percentiles are therefore reported
alongside two aggregations that do not let one project dominate:

| Percentile | Pooled | Per-repo values        | **Per-repo median** | Pooled without windmill |
| ---------- | -----: | ---------------------- | ------------------: | ----------------------: |
| p75        |      5 | 5, 1, 4, 3, 3, 5, 6    |               **4** |                       4 |
| p85        |      7 | 7, 2, 5, 4, 4, 6, 9    |               **5** |                       5 |
| **p90**    |      9 | 9, 3, 6, 5, 4, 7, 10   |               **6** |                       6 |
| p95        |     12 | 15, 4, 8, 9, 6, 11, 13 |               **9** |                       9 |

The per-repo median and the windmill-excluded pool agree at every percentile, which is the
signal that the pooled figure is the distorted one. **The Svelte p90 for prop count is 6.**

Note this lands well below React's empirical 13. That is consistent with the framework: Svelte
components pass content through snippets and children, expose two-way state through `bind:`, and
read shared state from context — all of which are props in React.

### Line count

| Percentile | Pooled | Per-repo values                    | Per-repo median |
| ---------- | -----: | ---------------------------------- | --------------: |
| p90        |    165 | 113, 97, 171, 62, 124, 135, 342    |         **124** |
| p95        |    262 | 150, 146, 203, 103, 183, 179, 516  |         **179** |
| p99        |    596 | 314, 325, 331, 236, 433, 277, 1029 |         **325** |

## Decision

| Rule                          | Constant    | Current |     New | Rationale                                                                                                   |
| ----------------------------- | ----------- | ------: | ------: | ----------------------------------------------------------------------------------------------------------- |
| `architecture/prop-count`     | `MAX_PROPS` |      10 |   **6** | the per-repo median p90, confirmed by the windmill-excluded pool                                            |
| `architecture/component-size` | `MAX_LOC`   |     400 | **200** | above the p90 median (124) and the p95 median (179), rounded to a memorable number on the conservative side |

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
 * 2,239 countable components in 7 real Svelte 5 codebases (4 libraries, 3 applications) — see
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
 * median is 124 lines and the 95th is 179. This threshold sits deliberately above both — a long
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

```
.svelte files scanned : 6460
parse failures        : 391
countable prop counts : 2239
no props at all       : 2527
legacy `export let`   : 7
$props() uncountable  : 1296

propCount pooled percentiles
  p50: 2   p75: 5   p85: 7   p90: 9   p95: 12   p99: 22   max: 72

components flagged at each candidate threshold (pooled)
  > 4: 29.0%   > 5: 22.2%   > 6: 17.3%   > 7: 13.6%
  > 9:  8.6%   > 10: 7.0%   > 13: 3.4%   > 20: 1.3%

loc pooled percentiles
  p50: 39   p75: 83   p90: 165   p95: 262   p99: 596   max: 5121
  > 116: 16.1%   > 200: 7.5%   > 300: 3.9%   > 400: 2.3%
```

The pooled flag rates above are themselves inflated by windmill; a project with a typical
distribution sees roughly 10% of its countable components flagged at `> 6`.
