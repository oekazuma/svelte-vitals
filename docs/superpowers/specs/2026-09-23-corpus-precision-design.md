# Corpus precision — design

Measured precision of every rule on real third-party SvelteKit apps, visible per PR and in an
internal report (`scripts/corpus/README.md`). It is a development aid, not a user-facing claim, so it
is deliberately not on the docs site. The v1.0 blocker is trust: false positives and wrong claims are what keep the tool from being
relied on, and until now nothing measured them. A 2026-09-23 sweep over 15 real apps found 17
false-positive classes that the unit tests, the kitchen-sink gallery and the ecosystem smoke had all
passed — every one of them visible only by reading findings on code nobody wrote for the tool.

## What it is not

- **Not the ecosystem smoke.** `2026-08-16-ecosystem-smoke-design.md` asserts only "no crash" and
  deliberately never reads findings, so a moving upstream cannot turn it into a muted job. That stays
  true. This is a separate instrument that reads findings, on a **pinned** corpus.
- **Not a count gate.** No finding count or precision threshold is asserted. The PR gate (below)
  fails only on verdict-backed regressions, and the drift test only asserts that the committed
  measurement covers every rule — not what it says.
- **Not a claim about unread findings.** Precision is computed over findings a human (or an agent,
  reviewed) has given a verdict. An unlabeled finding is "unknown", never assumed a true positive.
  The report always shows how many findings the number rests on.

## Corpus

`scripts/corpus/targets.json`: `{ repo, path, sha }` per app. Pinned, unlike the ecosystem corpus,
because a verdict is only valid for the exact code it was given on — upstream edits would silently
move `file:line` out from under it. Re-pinning is a deliberate commit that re-measures and drops the
verdicts that no longer match a finding. `sveltejs/kit` test fixtures are excluded: synthetic code
says nothing about precision on real apps.

Each target is cloned at its SHA (`git fetch --depth 1 origin <sha>`), `svelte-vitals.config.*`
files are deleted before analysis (the CLI imports them — same reason as the ecosystem smoke), and
the CLI runs with `--reporter json --no-suppressions`.

## Verdict ledger

`scripts/corpus/verdicts.json`: one entry per finding, keyed `app::rule::file:line::claim`, where
`app` is `owner/repo` or `owner/repo:path` and `claim` is the finding's title with digits masked
(`Multiple <h1> (#)`). The claim is part of the key so a rule that starts saying something else at the
same place shows up as a new, unreviewed finding instead of inheriting the old verdict; rewording a
rule's title orphans its verdicts on purpose. Route is not part of the key: a component finding repeats on every
route that renders it, and one reading of the code decides all of them. Not every finding has a line,
so the locus falls back in order: `file:line`, then `file` (the route-level SEO findings, one per
page file), then the route (findings with no file, e.g. a route with no `<h1>`), then `(site)` for
site-level findings (robots.txt, sitemap, `<html lang>`). The same distinct keys are what every count
is taken over — corpus findings, verdict counts, and the PR diff — so "findings" never exceeds what
one verdict per key can cover. Verdicts:

| verdict   | meaning                                                                                     |
| --------- | ------------------------------------------------------------------------------------------- |
| `tp`      | the rule's documented claim holds for this code                                             |
| `fp`      | the claim is false: the analyzer misread the code, or the rule contradicts its own docs     |
| `design`  | reported per documented semantics, but not demonstrably a defect (e.g. sibling `{#if}` ids) |
| `unclear` | could not be decided statically                                                             |

Each entry carries a one-line `basis`. Precision = `tp / (tp + fp)`; `design` and `unclear` are
shown, not folded in either way.

The ledger holds exact keys only, never predicates, so a finding a later change introduces can never
inherit a verdict nobody gave it. The first ledger was converted once from the 2026-09-23 triage's
predicates, keeping only keys present both in the triage's own reports and in the measurement being
committed — a finding the triage never saw stays unlabeled. When a finding goes away (a fix, a moved
line), its verdict becomes an orphan: `update` lists orphans and leaves them in place, because
dropping a verdict is a decision, not a side effect of re-measuring.

## Surfaces

1. **`pnpm corpus`** (`scripts/corpus-measure.js`, manual, needs `pnpm build`): `run` (full
   findings per app, deduplicated by key and title with a route count), `diff <a> <b>`, `update`
   (re-measure with the local build and rewrite `scripts/corpus/measurement.json` plus the generated
   table in `scripts/corpus/README.md`). `update` refuses to write when any app fails, since a missing app would silently
   read as findings removed. `measurement.json` is per-rule aggregates plus digests of the
   `targets.json` and `verdicts.json` it was computed from, so editing either without re-measuring
   fails the drift test. An update ends with `pnpm format`.
2. **PR job** (`.github/workflows/corpus.yml`, when `packages/**` or the corpus files change): builds
   the base and head, measures both with the head's script, and posts one sticky PR comment, like a
   coverage report — per-rule added/removed counts and precision before → after, the added and
   removed findings with their verdicts, and which added findings have none. A separate `gate` job
   fails when a finding with a `tp` verdict disappears (a real defect is now missed), a finding with
   an `fp` verdict comes back, or `measurement.json` is stale. Unreviewed new findings are listed, not
   failed: requiring a verdict for every one would make a detection change cost hundreds of
   verdicts. An intended change goes through by editing the verdict in the same PR, which puts the
   decision in the diff. `fp` verdicts are kept after the fix for exactly this reason. Whether `gate`
   blocks merging is the ruleset's decision. An app that fails on either side is named and left out of the
   comparison. Two jobs: the one that runs the PR's code over cloned third-party repos has only
   `contents: read`; the comment job holds `pull-requests: write` and runs neither. Fork PRs get the
   report in the job summary only.
3. **Internal report** `scripts/corpus/README.md`: per rule, corpus findings, apps, verdict counts
   and precision, generated from `measurement.json` + `verdicts.json` between markers.

## Keeping it honest when rules are added

The report table is generated from `allRules`, and a drift test fails the build when the committed
table differs from the generator's output — so a new rule cannot ship without re-running
`pnpm corpus update`, and it appears as "not yet reviewed" until verdicts are added. The PR gate
fails while `measurement.json` differs from the head measurement.

## Failed runs

A rule that throws is skipped with a `rule <id> failed and was skipped` warning on stderr while the
JSON report still parses. Its findings would then read as removed in the PR diff, or be missing from
a committed measurement. The script rejects any app whose stderr carries that warning, the same way
it rejects a non-JSON report or an exit 2.
