# JSON rule evidence: telling "found nothing" from "never ran" — design

**Date:** 2026-08-03
**Status:** approved
**Origin:** the first of four follow-ups recorded in `2026-07-31-score-honesty-design.md`, from a field
measurement on a real SvelteKit app.

## The problem

`--reporter json` cannot answer "did this rule run?".

`issues` is filtered to penalized results, so a rule that found nothing contributes no entry. `summary` is
a project-wide count of severities, so `passed` cannot be attributed to a rule. A rule reporting zero
therefore has two indistinguishable meanings — every declaration matched and passed, or nothing matched at
all — and zero is the output nobody thinks to question.

This is not hypothetical. A field test configured `architecture/unit-entry-file`, saw nothing, and could
not tell whether the tree conformed or the globs were dead. Proving the rule had executed required
planting a deliberately non-conforming unit. The same probe was needed for two sibling rules.

The console reporter does not have this gap — it lists every passing result under `Passed (N)`. **The gap
is specific to the JSON channel**, which is what the field test used and what CI uses.

## Design

### The key insight: counting results is not enough

Counting only the rules that produced results leaves the two cases identical, because both produce none.
What separates them is **enumerating the rules that were selected**, so a rule that ran and stayed silent
still gets an entry:

| Output                     | Meaning                                                                |
| -------------------------- | ---------------------------------------------------------------------- |
| key present, `findings: 0` | selected, ran, reported nothing                                        |
| key absent                 | not selected — `--ignore`, `--rules`, `--category`, or `off` in config |

Presence is the answer; the counts are the detail.

### Shape

`JsonReport` gains a top-level `rules` field:

```jsonc
"rules": {
  "architecture/unit-entry-file": { "findings": 0, "passed": 12 },
  "seo/single-h1": { "findings": 9, "passed": 342 }
}
```

**Not inside `summary`.** `Summary` is shared with the console reporter, the markdown reporter, the CLI
and the Vite plugin; a per-rule map would grow a type four consumers read and none of them want. The
follow-up that recorded this item said "in the `summary`" before that coupling was checked.

### Where the selected list comes from

`buildJsonReport` and `formatJsonReport` take an optional fourth parameter: the selected rule ids. Both
callers already compute them — the CLI holds `selectRules(allRules, config)` in a variable
(`packages/cli/src/index.ts`), and the Vite plugin calls it inline as an argument to `runRules`
(`packages/vite/src/analyze.ts`), so that call needs hoisting to a local.

Deriving the list inside the reporter instead was rejected: `selectRules` needs the full rule registry, so
the reporter would import `allRules` and stop being a function of `Result[]`.

Omitting the parameter keeps today's behaviour — entries only for rules that produced results — so the
change is additive for any external caller.

### What each entry counts

- **`passed`** — results this rule contributed that were not penalized. Available nowhere else: `issues`
  omits them and `summary.passed` is project-wide. This is the field that closes the gap.
- **`findings`** — penalized results. **Derivable** by scanning `routes[].issues[]` and `siteIssues[]` for
  the id, and included anyway: the point of this change is to make "did it run and find nothing" a local
  question, and forcing a full scan to answer the second half would defeat it. Recorded as deliberate
  redundancy so it is not read as an oversight.

No severity breakdown. Every issue already carries `id` and `severity`, so that grouping is both derivable
and derivable _locally_ — unlike `passed`.

### Counts describe the report, not the run

The CLI applies baseline, suppression and `--diff` filtering before the reporter sees the results, so the
counts describe what the report contains. A rule whose findings were all suppressed shows `findings: 0`
while remaining present.

That is the consistent choice — `rules` and `issues` then count the same things — but it is surprising
enough to state in the guide: presence proves selection, not that the rule found nothing in the tree.

## Not in scope

- **Other reporters.** The console already lists passes; this closes the JSON gap only.
- **`routes[].categories[].score`**, the second recorded follow-up. Same diagnosability theme, independent
  decision.
- **The HTML report and the dev dashboard.** `formatHtmlReport` (`packages/core/src/reporter/app-shell.ts`)
  and the Vite plugin's `buildSnapshot` (`packages/vite/src/ui/snapshot.ts`) both embed a `JsonReport` built
  on `buildJsonReport`'s three-argument form, so their `rules` map is seeded from results only — presence
  there means "produced a result," not "was selected," the opposite of what this design documents for the
  field of the same name. Left as-is rather than threaded: the dashboard's ran-rule list would have to come
  from a fresh `selectRules` call in `plugin.ts`, cascading through `installUiMiddleware` and `buildSnapshot`
  and into a dev-dashboard config whose live layer (`packages/vite/src/hooks/handle.ts`) already computes its
  own `selectRules` independently, in a separate process — reconciling that is a bigger question than this
  fix. Threading only the HTML report's easy case would leave the field still meaning two things across the
  three payloads, just in a different proportion, so neither was done. Nothing renders `rules` in either
  payload today; each call site carries a comment recording the gap.

## Testing

1. **A selected rule with no results appears**, as `{ findings: 0, passed: 0 }`. This is the whole point:
   without it the change is a convenience, not a fix.
2. **An unselected rule does not appear** — one disabled through config and one excluded by `--category`,
   since those are different code paths into `selectRules`.
3. **Omitting the parameter reproduces today's behaviour**, so an external caller sees no change.
4. **`passed` counts what `issues` cannot** — a rule contributing only passing results has a `rules` entry
   with `passed > 0` and no trace anywhere in `issues`. A test that only checks a rule with findings would
   pass even if `passed` were computed from the wrong set.
5. **Suppressed findings are not counted**, and the rule still appears — the surprising half of the
   filtering decision above.
6. **Both channels pass the list.** The Vite plugin's `selectRules` call is currently inline; a test that
   only covers the CLI would not notice it being left that way.
