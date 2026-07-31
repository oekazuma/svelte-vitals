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

The field reporter reasonably concluded that `info` findings must be excluded from category scores by
design. **They are not.** `computeScore` deducts for every severity:

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

Flooring both establishes one invariant, which is the whole point of the change:

> **A displayed 100 means the deduction was exactly zero.**

`floor(mean) === 100` holds only when every key scores exactly 100, i.e. no penalized finding carries a
route. `score` then equals `100 - sitePenalty`, so a displayed 100 also requires no site-wide finding.
`health` floors the weighted mean of category scores, so a displayed 100 requires every present category
to be 100 — no findings anywhere.

**Every score moves down by 0 or 1** (that is the maximum difference between `floor` and `round`). This is
a visible change to the product's headline figure and needs saying plainly in the changeset. Two
consequences are worth naming there:

- a `--min-health` gate set at or just above a project's current score can start failing, and the fix is
  a one-point adjustment, not a workaround;
- `--min-health 100` becomes a gate that fails on any finding at all. That is the honest reading of 100
  and is the intended behaviour, not a side effect.

Unchanged: the empty case (`scores.length` zero → 100, matching `computeHealth`'s no-categories → 100)
and the `CRITICAL_CAP` behaviour.

### 2. `architecture/unit-entry-file` stops emitting passes

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

**The fix is to stop emitting the pass, not to emit it only for `.svelte`.** The conditional version
still rests on a false premise: "the entry file is already a score key" is not guaranteed even for
`.svelte`, because the rules that key those files gate themselves — `architecture/component-size`'s
`applies` is `c.loc > 0`, so a `.svelte` file that fails to parse produces no key at all. Any rule
reasoning about whether _other_ rules keyed a path is reasoning about their `applies` conditions, which
is not a contract they offer.

Emitting nothing on success matches `architecture/directory-naming` and
`architecture/reserved-directory-names`, so the three directory-shaped rules become consistent: they
speak only when something is wrong.

The cost is real and small: `summary.passed` falls by the number of conforming units, and the rule stops
appearing in any reporter's pass list. For an L3 rule that is inert until declared, silence on success is
the normal shape.

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

- **Proportionality.** Making a category score reflect _how many_ findings exist, not merely whether any
  do. The existing `CRITICAL_CAP` is evidence the original design already knew averaging destroys
  severity — a lone `critical` moves a 585-key mean by 0.026 points, and only the cap makes it visible.
  `warning` and `info` have no equivalent net.
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
6. **Existing score expectations are updated as part of this change.** Numbers pinned in existing tests
   shift by 0 or 1. This is the intended outcome and the one context in which editing an existing test
   expectation is correct — every such edit must be reviewed as a deliberate re-baselining, and any test
   whose expectation moves by more than 1 point is a bug in this change, not a test to update.
