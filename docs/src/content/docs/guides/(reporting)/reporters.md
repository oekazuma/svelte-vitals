---
title: Reporters
description: Choose how svelte-vitals formats and outputs its findings.
sidebar:
  order: 1
---

svelte-vitals supports seven output reporters. Select one with `--reporter <fmt>`, or let auto-selection pick the right one for your environment.

## Available reporters

### `console` (default)

Human-readable text output, suitable for terminal use. Groups findings by severity and includes route paths and file locations.

```bash
svelte-vitals --reporter console
```

### `json`

Machine-readable JSON output. Useful for scripts, dashboards, or feeding results into other tools.

```bash
svelte-vitals --reporter json
```

#### Shape

```jsonc
{
  "version": "0.35.0", // the svelte-vitals version that produced this report
  "score": 97, // combined Health score, 0-100 (floored: 100 means zero deduction)
  "weights": { "seo": 1 }, // per-category Health weights actually applied
  "categories": {
    "seo": {
      "score": 94,
      "scoreModel": {
        "routeAverage": 94, // mean of the per-route scores, floored
        "sitePenalty": 0, // deducted for site-wide findings (no route)
        "criticalCap": null // the cap value when a critical finding lowered the score, else null
      },
      "keys": 42, // routes (or other scored units) this category measured
      "affectedKeys": 6 // of those, how many carried at least one finding
    }
  },
  "summary": { "critical": 0, "warning": 33, "info": 44, "passed": 610, "dynamic": 2 },
  "rules": {
    // Every rule that ran. An entry with `findings: 0` ran and reported nothing;
    // a rule missing from this map was disabled at the top level — `--ignore`, `--rules`,
    // `--category`, or `rules: { id: 'off' }` in config. A rule disabled through an
    // `overrides` entry instead still ran and still appears here (see below).
    "architecture/unit-entry-file": { "findings": 0, "passed": 12 }
  },
  "routes": [
    {
      "route": "/about", // a route id, or a source file path for file-scoped rules
      "score": 95, // share of this route's rule inventory (by category/scope, weighted by severity) left intact
      "categories": { "seo": 94 }, // per category present on this route, scored against that category's own inventory
      "issues": [
        {
          "id": "seo/single-h1", // the rule id
          "category": "seo",
          "severity": "warning", // after any severity override you configured
          "title": "Two <h1> elements", // the human-readable finding
          "detection": { "presence": "none", "value": "absent" },
          "location": "src/routes/about/+page.svelte",
          "line": 12,
          "recommendation": "Keep exactly one <h1> per page.",
          "docsUrl": "https://svelte-vitals.dev/rules/seo/single-h1",
          "fix": { "description": "…", "snippet": "…", "lang": "svelte" }
        }
      ]
    }
  ],
  "siteIssues": [], // findings with no route (robots.txt, sitemap.xml, …), same issue shape
  "inventories": {
    "seo::route": 110 // floored severity weight behind every "seo" key scored against "route"
  }
}
```

A category's score on a key is the share of that category's severity weight that survived. Checks are
grouped by category and scope — the keys of `inventories`, like `seo::route` — and **within one group** a
`warning` costs five times an `info` and a `critical` fifteen times, so a more severe finding always costs
more. **Across groups it does not**: a group that checks very few things is scored against a floor of 25,
which makes each of its findings a larger share, so a `warning` in a small group can cost more than a
`critical` in a large one. Repeated findings from the same rule on the same key cost what one costs. Beside
the score, `affectedKeys` says how much of the project the category touched: the score is depth, that is
reach.

Two things follow that the paragraph above doesn't say directly:

- per-key scores are comparable **within** a category; across categories the number says which category has
  a larger share of _its own_ checks failing, not which problem is worse.
- `inventories` gives the divisor behind every key of one pair, so a route's per-category score
  (`routes[].categories`) recomputes by hand from it — this holds because a key is either a route id or a
  source file path, and those two key spaces never overlap, so a category's results on one key always share
  one scope. A route's own `score` does not recompute the same way, once the route spans more than one pair:
  it sums the raw inventory of every pair touched and floors that sum once, while `inventories` publishes
  each pair already floored on its own — the two can disagree.

Two field names are worth pointing out, because guessing them wrongly fails silently:

- the rule identifier is **`id`**, not `rule`;
- the finding text is **`title`**, not `message`.

`line`, `docsUrl` and `fix` are present only when the rule supplies them, and `location` only for a finding tied to a file. `issues` lists **failing** findings only — passing checks are counted in `summary.passed` but are not listed. A route with no failures still appears in `routes`, with an empty `issues` array and its own score.

`categories` holds only the categories that produced a result on that route — an absent category means "not measured here," not "perfect here." Its values are **not guaranteed** to average to the route's own `score`, in either direction: `score` is one ratio over everything the route was measured against, while each category score uses that category's own inventory. They agree whenever every category on the route scores the same ratio (including every route with no findings) and can differ by several points otherwise.

`rules` answers a question the rest of the report cannot: **whether a rule ran at all.** `issues` lists
only failing findings, so a rule that found nothing leaves no trace there — and a rule disabled at the top
level (`--ignore`, `--rules`, `--category`, or `rules: { id: 'off' }` in config) leaves the same absence.
Look it up in `rules` instead: present means it ran, missing means it was excluded at the top level — with
one exception, below.

The counts describe the report, not the tree. Baseline, suppression and `--diff` filtering are applied
before the report is built, so a rule whose findings were all suppressed shows `findings: 0` while remaining
present. The same is true of a rule disabled through an `overrides` entry rather than at the top level:
`overrides` drops its results (passing ones included) after the rule has already run, so it shows
`{ "findings": 0, "passed": 0 }` — indistinguishable from a selected rule that simply found nothing.
Presence in `rules` proves a rule wasn't excluded by `--ignore`, `--rules`, `--category`, or config's
top-level `rules`; it does not prove `overrides` left anything for it to find.

### `agent`

A Markdown remediation document designed for AI coding agents. Each failing finding includes:

- The route and source file location
- A concrete code fix with a snippet
- An acceptance check

The `agent` reporter is auto-selected when svelte-vitals detects a known AI-agent environment (e.g. Claude Code sets `CLAUDECODE`). When auto-selected (not explicitly requested), a one-line hint is printed to stderr explaining how to override.

```bash
svelte-vitals --reporter agent
```

Override auto-selection via the environment variable:

```bash
SVELTE_VITALS_REPORTER=agent svelte-vitals
```

### `sarif`

[SARIF v2.1](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html) format, compatible with GitHub Code Scanning, Azure DevOps, and other SAST tooling that consumes SARIF.

```bash
svelte-vitals --reporter sarif
```

### `github`

GitHub Actions [workflow command](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/workflow-commands-for-github-actions) format. Outputs `::error` and `::warning` annotations that appear inline in pull requests.

The `github` reporter is auto-selected when `GITHUB_ACTIONS=true` is set (which GitHub Actions sets automatically).

```bash
svelte-vitals --reporter github
```

### `md`

A compact Markdown summary — Health score, per-category score table, severity counts, and a
findings table with links to each rule's docs page. Designed for a GitHub Actions job summary or
a PR comment; capped at 50 finding rows to stay within GitHub's comment size limits. See the
[CI integration guide](/guides/ci) for `svelte-vitals ci install`, which wires
this reporter into a generated workflow automatically.

```bash
svelte-vitals --reporter md
```

## HTML report

`--reporter html` writes a self-contained HTML report. It is the **same UI as the [live dashboard](/guides/dev-dashboard)** — one shared renderer, so the two can't drift: searchable sortable route list, severity/category filters, dark mode, and a copy-to-clipboard [AI Prompt](/guides/dev-dashboard#copy-a-fix-prompt-for-any-finding) on every finding.

A static file has no dev server behind it, so the live-update machinery (SSE, `measured` refinement) is absent. All CSS and JS are inlined, so it works offline and travels well as a CI artifact.

```bash
svelte-vitals --reporter html                 # writes svelte-vitals-report.html
svelte-vitals --reporter html --out-file report.html
svelte-vitals --reporter html --out-file -     # write to stdout instead of a file
```

By default it writes `svelte-vitals-report.html` in the current directory and prints the path to stderr. Use `--out-file <path>` to change the location, or `--out-file -` to stream it to stdout (for piping or CI artifacts).

## Auto-selection priority

1. **Explicit `--reporter <fmt>`** — always wins.
2. **`SVELTE_VITALS_REPORTER` environment variable** — overrides auto-detection.
3. **AI-agent environment** (e.g. `CLAUDECODE` is set) → `agent`.
4. **GitHub Actions** (`GITHUB_ACTIONS=true`) → `github`.
5. **Default** → `console`.

## Example: CI pipeline

```yaml
# .github/workflows/seo.yml
- name: Check SEO
  run: npx svelte-vitals@latest --fail-on warning
  # GITHUB_ACTIONS is already set; github reporter is auto-selected
```
