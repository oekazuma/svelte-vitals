---
title: Health report
description: Understand the weighted Health score and use --min-health as a CI gate.
sidebar:
  order: 8
---

The **Health score** is a single 0–100 number that summarizes your project's overall quality across the categories present in the analysis results. It is used by the `--min-health` flag to gate CI pipelines.

## How the score is calculated

Health is computed in two stages:

### 1. Category score

For each active category (SEO, Performance), svelte-vitals computes an independent score:

- Every route starts at **100**.
- Each failing finding deducts points based on severity:
  - `critical` → −15 per route
  - `warning` → −5 per route
  - `info` → −1 per route
- Deductions are taken once per (route, rule) pair — duplicates take the maximum deduction, not a sum.
- Route scores are averaged to produce the category's headline score.
- If any critical finding is present, the headline score is capped at **79**.

### 2. Weighted Health

Health averages the category scores using configurable weights. By default every present category has equal weight (`1`):

```text
Health = (SEO_score × w_seo + Performance_score × w_perf) / (w_seo + w_perf)
```

**Only categories present in the results are included.** If your project has no images, no Performance rules fire, the Performance category produces no results, and Health is based solely on SEO. Performance only appears when the project has images that trigger Performance rules.

The result is rounded to the nearest integer.

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
Health: 85  (SEO: 90 · Performance: 75)
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
