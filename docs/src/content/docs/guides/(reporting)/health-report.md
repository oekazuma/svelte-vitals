---
title: Health score
description: Understand the weighted Health score and use --min-health as a CI gate.
sidebar:
  order: 2
---

The **Health score** is a single 0–100 number that summarizes your project's overall quality across the categories present in the analysis results. It is used by the `--min-health` flag to gate CI pipelines.

## How the score is calculated

Health is computed in two stages:

### 1. Category score

For each active category (SEO, Performance), svelte-vitals computes an independent score:

- Each route scores the share of that category's checks it was measured against — weighted by severity —
  that passed: no failures scores **100**. A route is never scored against less than 25 points of severity
  weight (the _inventory floor_ — see the [Reporters guide](/guides/reporters) for the full rule). The floor
  only helps a thin inventory: it stops one or two findings from zeroing out a route that checks very little.
  Once that inventory reaches 25 on its own, the floor changes nothing, and a route failing every applicable
  check still scores **0**.
- Severity sets the weight a failing check carries: `critical` weighs 15, `warning` weighs 5, `info` weighs 1.
- A failing check counts once per (route, rule) pair — duplicates take the maximum severity, not a sum.
- Route scores are averaged to produce the category's headline score.
- If any critical finding is present, the headline score is capped at **79**.

### 2. Weighted Health

Health averages the **unrounded** category scores using per-category weights. By default every present category has equal weight (`1`). With just SEO and Performance present, for example:

```text
Health = (SEO_score × w_seo + Performance_score × w_perf) / (w_seo + w_perf)
```

The formula shows two categories for brevity — the same weighted average runs over **all** categories present in the results, up to six (SEO, Performance, Correctness, Security, Architecture, Accessibility).

Set weights with the `--weights` flag or the config file's `weights` field — see [Config file](/guides/configuration) for both. For example, to make SEO count double:

```bash
svelte-vitals --weights seo=2
```

**Only categories present in the results are included.** If, for example, nothing in your project matches any Performance rule, the Performance category produces no results and Health is based solely on the remaining categories.

The result is **floored**, not rounded to nearest, so a displayed score of 100 means the deduction was
exactly zero. Any finding at all — even a single `info` — puts its category's score at 99 or below.

**Weights change Health, never a category's own score.** A category score is computed from that category's
findings alone, so weighting a category `0` does not raise its score. What `0` does is leave the category
out of the Health average entirely — which is why Health can read 100 while a `0`-weighted category
displays a score of its own, `critical` findings and all.

Health is floored **once**, from the unrounded category scores. It is therefore not always equal to the
average of the category scores you see printed, and can sit up to a point above them: each printed category
score is itself floored, and flooring twice would compound the loss.

## `--min-health` gate

Fail the run (exit code `1`) when the Health score falls below a threshold:

```bash
svelte-vitals --min-health 80
```

This is useful as a CI gate separate from `--fail-on`:

- `--fail-on` reacts to individual finding severity.
- `--min-health` reacts to the aggregate weighted score.

Both can be used together.

## Example output

```text
Health: 82  (SEO: 90 · Performance: 75)
```

When only SEO rules fire:

```text
Health: 90  (SEO: 90)
```

## Per-route breakdown

Add `--by-route` to see the score for every individual route alongside the site-wide Health:

```bash
svelte-vitals --by-route
```
