# Score honesty: a displayed 100 must mean zero findings — design

**Date:** 2026-07-31
**Status:** approved
**Origin:** a field measurement on a real SvelteKit app (~1,600 files under `src/`, 351 routes), reported
2026-07-31.

## The problem

A category carrying **276 real findings displayed a score of 100.**

That is not a rounding inaccuracy. It is a reversal of meaning: `100` reads as "nothing wrong", and it was
printed for a tree with 276 things wrong. The headline Health number is the product's capstone
(`2026-06-23-health-report-design.md` calls it "the headline number for 1.0"), so a number that says
"perfect" while findings exist undermines the one figure users are meant to trust.

The field report could not tell, from the output alone, whether `info` findings were excluded from
category scores by design or were being lost somewhere — and asked. That the question could not be
settled from the report is itself a finding; see the diagnosability follow-up. **They are not excluded.**
`computeScore` deducts for every severity:

```js
const DEDUCTION = { critical: 15, warning: 5, info: 1 };
```

The cause is the rounding of the mean:

```js
const routeAverage = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
```

Reproduced at the reported scale — 585 score keys, one `info` finding on N of them, run through the
actual `computeHealth`:

| findings | raw mean | displayed |
| -------- | -------- | --------- |
| 233      | 99.602   | **100**   |
| 276      | 99.528   | **100**   |
| 292      | 99.501   | **100**   |
| 293      | 99.499   | 99        |
| 585      | 99.000   | 99        |

It takes **293 findings** to move the displayed score off 100, and a finding on _every single key_ still
shows 99.

## Scope

Two changes, both about the number not lying. A third, larger question is deliberately left open.

## Design

### 1. `Math.round` → `Math.floor`, in two places

Rounding happens at `routeAverage` (`computeScore`) and at `health` (`computeHealth`). The intermediate
`score = routeAverage - sitePenalty` is integer arithmetic and needs no change.

**`health` must floor the unrounded category means, not the displayed category scores.** Today it averages
integers that were themselves already rounded, so the two stages compose: with raw category means
`[99.9, 99.9, 99.9, 99.9, 97.9]`, `round` gives `[100, 100, 100, 100, 98]` → mean 99.6 → **100**, while a
naive two-stage floor gives `[99, 99, 99, 99, 97]` → mean 98.6 → **98**. A two-point move, from a change
whose whole premise is that the difference is at most one.

So `computeScore` exposes its unrounded route mean, and `computeHealth` averages those and floors **once**.
The same case then yields mean 99.5 → **99**: one point, as intended.

This is the standard reason not to aggregate rounded intermediates, and it has a visible consequence worth
stating: `health` is no longer re-derivable from the displayed category scores and may sit up to a point
above their mean. That is correct — the displayed category score is a floor of its own raw value, and
flooring twice would compound the loss — but it is the kind of arithmetic a user cannot check from the
report, which is one more reason the diagnosability follow-up matters.

Flooring both establishes one invariant, which is the whole point of the change:

> **A displayed 100 means the deduction was exactly zero.**

`floor(mean) === 100` holds only when every key scores exactly 100, i.e. no penalized finding carries a
route. `score` then equals `100 - sitePenalty`, so a displayed 100 also requires no site-wide finding.
`health` floors the mean of the raw category values, so a displayed 100 requires every **present**
category to be exactly 100.

**"Present" is load-bearing, and the invariant is bounded by it.** `scoresByCategory` buckets only the
categories that produced results, so a category no rule reported on is excluded from the mean rather than
counted as 100 — verified against `computeHealth`, which returns a single-category Health when only one
category is present. The hole is subtler: a category that _is_ present because some of its rules ran can
still contain L3 rules that are inert for want of a declaration. `architecture` is present on any project
with components, whether or not a single directory rule was ever configured.

So the honest statement of the invariant is: **a displayed 100 means no finding among the checks that
actually ran.** It cannot mean more than that in a tool whose convention rules are inert until declared,
and writing it the stronger way would set up the same "it said 100 and still missed something" complaint
this spec exists to prevent.

**Every score moves down by 0 or 1** (that is the maximum difference between `floor` and `round`). This is
a visible change to the product's headline figure and needs saying plainly in the changeset. Two
consequences are worth naming there:

- a `--min-health` gate set at or just above a project's current score can start failing, and the fix is
  a one-point adjustment, not a workaround;
- `--min-health 100` becomes a gate that fails on any finding at all. That is the honest reading of 100
  and is the intended behaviour, not a side effect.

Unchanged: the empty case (`scores.length` zero → 100, matching `computeHealth`'s no-categories → 100)
and the `CRITICAL_CAP` behaviour.

### 2. `architecture/unit-entry-file`'s pass stops creating a score key

It is the only rule in the codebase that seeds a score key no other rule is guaranteed to produce. Its
pass is keyed on the unit's entry file:

```ts
route: `${dir}/${baseName(dir)}${ext}`;
```

The family's own spec (`2026-07-29-directory-naming-design.md`) recorded why that was thought safe:

> M1 emits one per conforming unit and can afford to, because it keys the pass on the unit's entry file —
> for a component unit that is a `.svelte` path already present as a score key, so it adds nothing to the
> denominator.

Note the hedge: **"for a component unit"**. `units` accepts any extension, and the field configuration
declared `.ts` entries — 109 fresh `100`s entered the denominator, exactly the dilution the sibling rule
refused to cause.

Emitting it only for `.svelte` is not the fix. That conditional still rests on a false premise: "the entry
file is already a score key" is not guaranteed even for `.svelte`, because the rules that key those files
gate themselves — `architecture/component-size`'s `applies` is `c.loc > 0`, so a `.svelte` file that fails
to parse produces no key at all. Any rule reasoning about whether _other_ rules keyed a path is reasoning
about their `applies` conditions, which is not a contract they offer.

**Nor is deleting the pass the fix, because the pass is the only per-rule evidence that the rule ran.**
An earlier draft of this spec chose deletion, on the grounds that it would make the three directory rules
consistent. Review established that it would make them consistently unverifiable. A rule reporting zero
findings has two indistinguishable meanings — every declaration matched and passed, or nothing matched at
all — and zero is the output nobody thinks to question. The field test hit exactly this: `unit-entry-file`
reported nothing, and proving it had run at all required planting a deliberately non-conforming unit. The
same probe was needed for the two sibling rules, precisely because they already emit no passes.

Note that the pass **is** visible today: the console reporter lists every passing result under
`Passed (N)`. It is the JSON reporter that hides them, since `issues` is filtered to penalized results —
which is why the field test, run through `--reporter json`, could not see it.

**The fix is to emit the pass with no `route`.** `computeScore` seeds its denominator only from results
that carry one (`results.filter((r) => r.route !== undefined)`), and the project-scoped branch only ever
reads penalized results, so a route-less pass creates no score key and no penalty — while remaining a
result, counted in `summary.passed` and listed by the console reporter. The denominator problem and the
evidence it was carrying are separable, and separating them costs one field.

The three directory rules stay inconsistent in what they emit on success, and that is now a recorded gap
rather than a resolved one: `directory-naming` and `reserved-directory-names` are still unverifiable from
their output alone. Making the whole family verifiable is a diagnosability question, listed below with the
others.

## What this does not fix, stated so it is not mistaken for fixed

**Findings are still not proportional to the score.** After flooring, a category with 1 finding and a
category with 276 findings both display 99. The magnitude is invisible because a single finding moves a
mean of N keys by `1/N`, and N is the size of the tree.

This spec restores the top of the scale, not the middle of it. That is a deliberate ordering: the most
harmful lie a headline number can tell is "perfect" when it is not, and separating the two changes keeps
it clear which one produced any observed difference.

Note also that fixing `unit-entry-file` does **not** reduce dilution meaningfully. In the configuration
that exposed it the denominator was 451 keys, of which 109 were the rule's own passes; removing them
changes what one finding is worth from 1/451 to 1/342 — 0.0022 to 0.0029 points. It is a correctness fix
— the denominator should not contain keys invented by a single rule — not a dilution fix.

Two follow-ups are recorded, neither in scope here:

- **Proportionality — and this change raises its priority rather than lowering it.** Making a category
  score reflect _how many_ findings exist, not merely whether any do. The existing `CRITICAL_CAP` is
  evidence the original design already knew averaging destroys severity — a lone `critical` moves a
  585-key mean by 0.026 points, and only the cap makes it visible. `warning` and `info` have no
  equivalent net. Review made the sharper point: after this change an `info`-dominated category on a
  large tree becomes a **one-bit signal**, fixed at 99 whether it carries one finding or five hundred.
  Trading "100 is a lie" for "99 says nothing" is the right trade only if the second half gets fixed.
- **`routes[].categories[].score` in the JSON report.** The field reporter could not audit the
  100-with-276-findings contradiction because per-route scores are aggregated before they are exposed,
  and reached the wrong conclusion as a result. That is a diagnosability gap with a demonstrated cost,
  but it is a reporting change rather than a scoring one.

## Testing

1. **The invariant, from both sides.** A result set whose mean is exactly 100 displays 100; a result set
   with a single `info` finding among many passes displays 99, never 100. The second case is the
   regression test for the reported bug and must fail before the change.
2. **The boundary.** A mean of 99.5 floors to 99. Under the old code it rounded to 100, so this pins the
   direction of the change rather than merely its result.
3. **`health` floors too.** Category scores that average to a fraction produce the floored Health, not the
   rounded one — otherwise the invariant holds per category but breaks in the headline.
4. **Unchanged edges.** No results → 100. All passes → 100. A `critical` still caps at 79.
5. **`unit-entry-file` emits nothing for a conforming unit**, for a `.svelte` entry and a `.ts` entry
   alike, while its violation cases stay byte-identical. The `.ts` case is the one that motivated the
   change; the `.svelte` case proves the fix was not narrowed to the reported symptom.
6. **`health` moves by at most one point, and that is a test, not a comment.** Raw category means of
   `[99.9, 99.9, 99.9, 99.9, 97.9]` must yield 99, not the 98 that averaging the floored category scores
   produces. Without this case the double-rounding regression is invisible, because every single-category
   fixture agrees under both schemes.
7. **A route-less pass creates no score key.** `unit-entry-file` on a fully conforming tree leaves the
   category score identical to a run where the rule is disabled, while `summary.passed` still counts the
   units it checked. Both halves are the point: no denominator growth, evidence retained. Also confirm a
   `--diff`-filtered run behaves sensibly for a result carrying neither route nor location.
8. **Existing score expectations are updated as part of this change.** Numbers pinned in existing tests
   shift by 0 or 1. This is the intended outcome and the one context in which editing an existing test
   expectation is correct — every such edit must be reviewed as a deliberate re-baselining, and any test
   whose expectation moves by more than 1 point is a bug in this change, not a test to update. That bound
   holds only because `health` floors once; it is exactly what test 6 protects.
