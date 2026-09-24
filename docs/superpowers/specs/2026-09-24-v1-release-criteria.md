# v1.0 release criteria — false positives on apps the tool has never seen

The question this answers: at what measured numbers can we tell people "use this; its findings are
almost never wrong"? The line is drawn here, before the holdout apps are measured, so the numbers
cannot be fitted to the result. The decision to release stays with the owner; this is the ruler.

## Why a holdout

The 16 apps in `scripts/corpus/targets.json` are where the 2026-09 false-positive work was found and
fixed. Every finding there now has a verdict and none is `fp`, but that is measured on the data the
fixes were made against. It says nothing about the first run on a new project, which is what a new
user experiences. A holdout is a set of real apps the tool has not been tuned on, measured once,
labelled, and judged against the criteria below **before anything is fixed**.

## Procedure

1. **Select** at least 10 apps against the checklist below, and record why each one was picked and
   which rule gap it targets. Do this before running the CLI on any of them.
2. **Pin** them in `scripts/corpus/holdout.json` (same shape as `targets.json`).
3. **First look.** Run the current `main` build once (`pnpm corpus run`) and commit the raw result
   as `scripts/corpus/holdout-<date>.json`. The criteria are evaluated on that file only.
4. **Label** every finding with the verdict protocol that was used for the tuning corpus: independent
   checks over the source, one pattern read per group, and an assertion that the output covers every
   input key. No finding may be left without a verdict.
5. **Judge** each criterion below against the first-look file and publish one table: measured value,
   threshold, pass or fail.
6. **Afterwards**, fix whatever failed. The holdout apps then join `targets.json` like any other
   corpus app. A failed holdout cannot be re-run to a pass: claiming the criteria again needs a new
   holdout of apps nobody has tuned on.

## Holdout checklist

The tuning corpus is heavy on documentation sites and UI-library galleries (five of 16) and has two
Svelte 4 apps. The holdout should cover what it lacks:

- SvelteKit 2 and Svelte 5 runes throughout (no docs sites, no UI-library galleries)
- an app that emits JSON-LD
- an i18n app with alternate-language links (e.g. paraglide)
- an app using sveltekit-superforms
- an app using a meta-tag library (e.g. svelte-meta-tags)
- a markdown/mdsvex blog
- an app deployed under `kit.paths.base`
- a large SPA or dashboard (many routes, `ssr = false` somewhere)
- an adapter-node app with server hooks and form actions
- at least three apps that `vite build` without extra services, for the build-mode check

## Criteria

Severity is the rule's default severity. Precision is `tp / (tp + fp)` over the labelled findings. A
false-positive _class_ is one root cause; it counts once for the class limits and for every finding
it produces in the precision numbers.

| #   | Criterion                                                                                             | Threshold             |
| --- | ----------------------------------------------------------------------------------------------------- | --------------------- |
| C1  | CLI crashes (exit other than 0/1) on holdout apps                                                     | 0                     |
| C2  | Build-mode (`@svelte-vitals/vite`) crashes on the holdout apps that build                             | 0, on at least 3 apps |
| C3  | `fp` findings from **critical** rules (they fail a user's CI)                                         | 0                     |
| C4  | Precision of **warning** findings                                                                     | ≥ 98%                 |
| C5  | Precision of **info** findings                                                                        | ≥ 95%                 |
| C6  | Any fp class that appears in 2 or more holdout apps                                                   | none                  |
| C7  | Per rule with ≥ 10 holdout findings: precision                                                        | ≥ 90%                 |
| C8  | `design` share of **critical + warning** findings (reported as documented, not a demonstrable defect) | ≤ 30%                 |
| C9  | Holdout findings without a verdict / with `unclear`                                                   | 0 / ≤ 1%              |
| C10 | Rules with at least one labelled finding across tuning corpus + holdout                               | ≥ 70 of 105           |

Notes on the choices:

- **C3 is absolute** because a critical finding exits 1. One false critical breaks someone's CI on
  the first run, which is the failure that loses a user for good.
- **C6 exists because an aggregate can hide a systemic bug.** Precision of 98% with the 2% all from
  one class that hits every app means every user meets it.
- **C8 governs noise, not falsehood.** A `design` finding is not wrong, but a warning rule that mostly
  reports things that are not defects trains people to ignore warnings. It is measured on critical
  and warning only; info findings are opt-out advice.
- **C10 is about what we can vouch for.** A rule that never fired on any real app has no measured
  precision. Rules still without evidence are listed by name in the release notes as "not yet
  measured on real apps", not silently counted as passing.

## What these criteria do not cover

- **Misses (recall).** There is no ground truth for what a real app should be told, so a rule that
  stays silent when it should report is not measured here. The kitchen-sink gallery pins that each
  rule fires on its planted defect; that is the only recall guard.
- **Rendered-mode findings on apps that cannot be built** without their services (databases, API
  keys). C2 covers crashes; parity of findings between modes is measured only where a build succeeds.
- **Configuration.** Everything is measured under the default config, which is what a first run uses.

## Current state (tuning corpus, 2026-09-24)

5,552 findings, all labelled: tp 4,870, design 680, unclear 2, fp 0. 58 of 105 rules have at least
one finding. That is the starting point, not evidence for the criteria above.
