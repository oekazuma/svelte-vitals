# A count of what a declaration examined — design

**Date:** 2026-08-07
**Status:** proposed
**Origin:** a field verification of 0.42.0. To establish that `architecture/reserved-name-placement` reporting
zero findings meant "the tree complies" rather than "nothing was checked", the project had to **plant a
deliberate violation, observe it, and delete it again**. Nothing in the output could answer the question.

## The problem

The charter's inverse-precision gate already states it:

> **zero findings reads identically as "the project complies" and "the declaration matched nothing."**

and records the fix as its own unbuilt spec: "Exposing per-rule examined counts in the CLI would let a user keep
checking this after ship rather than only the author before it." This is that spec, one level finer.

**The gap got wider, not narrower, in 0.42.0.** Before it, one of the rule's diagnostics fired on a correct
declaration — and that false note was the only evidence the rule had run at all. Fixing it left a compliant
project with a completely empty result: no routes, no findings, no notes. The observability was accidental, and
correcting the diagnostic removed it.

### More diagnostics cannot answer this

The natural instinct is to report a declaration that examined nothing. **That is the case 0.42.0 deliberately
made silent.** A convention document that declares every permitted position — including ones no directory
occupies yet — is correct, and telling its author to "correct the glob or remove the declaration" is advice to
delete a check they will want. That decision is recorded and should stand.

So the thing a reader needs is **information, not a verdict**: how many places each declaration judged. Zero is
a legitimate answer that must not be styled as a problem.

### The existing per-rule counter cannot answer it either

`RuleEvidence` is `{ findings, passed }`, computed from `Result[]`. It distinguishes "ran and found nothing"
from "never selected" only because `buildJsonReport` seeds it from the list of rules that ran. **A count of
places examined is not derivable from results**: this rule emits no pass results — deliberately, because
`computeScore` seeds every distinct `route` at 100 and a pass per directory would dilute every real finding —
so a directory it judged and permitted leaves no trace at all.

And per-**rule** is not the granularity the question has. One `reserved-name-placement` configuration carries
eight declarations. "The rule examined 137 places" does not answer "did `parts` see 28 or 0?".

## The design

**The engine gives every rule a sink, and returns what they wrote to it.**

```ts
runRules(rules, ctx): Promise<{ results: Result[]; examined: Record<string, Record<string, number>> }>
```

`runRules` constructs the sink, passes an augmented context to each rule, and returns the counts keyed by rule
id. A rule that does not count writes nothing and appears with no entry.

**The engine owns it rather than each caller**, and that is the load-bearing choice. There are three call sites
— the CLI, the Vite build-mode analysis, and the dev-server hooks. If each had to construct and thread a sink,
one could omit it and the counts would be **silently absent**, which is the exact failure shape this feature
exists to remove, and the shape this branch's predecessors hit twice in option forwarding. Returning it from
`runRules` makes omission a type error.

`runRules`'s return type changes, and it is exported from `@svelte-vitals/core`. Pre-1.0, recorded in the
changeset.

### The shape in the report

```jsonc
"rules": {
  "architecture/reserved-name-placement": {
    "findings": 0,
    "passed": 0,
    "examined": {
      "capitalisedUnitPlacements.parts → src/**": 28,
      "capitalisedUnitPlacements.styleGuide → src/**": 109,
      "anyCaseUnitPlacements.types → src/**": 0
    }
  }
}
```

`examined` is optional and absent for rules that count nothing, so no existing consumer breaks.

**The labels are the ones the diagnostic already uses.** `reserved-name-placement`'s aggregated finding names a
bad declaration as `capitalisedUnitPlacements.parts → src/lib`; the count uses the identical string. A reader
who sees a declaration named in one place and a different name for it in the other cannot join them, and
joining them is the whole point — the count is what makes a _silent_ declaration legible next to the diagnostic
that describes a _broken_ one.

**Zero is information.** `anyCaseUnitPlacements.types → src/**: 0` means the declaration is live, reachable and
currently unoccupied — precisely the state 0.42.0 decided not to report. The report states the number; the
reader decides.

### What the number counts, for this rule

**The number of reserved-name directories judged against that declaration.** Not the directories the glob
matches, and not the findings produced: a `parts/` that the declaration permitted counts, and so does one it
did not. That is the number that answers "did this declaration see the 28 `parts/` directories in my tree?".

### It is not filtered

`--diff`, `--baseline` and suppressions narrow **results**. They do not narrow the counts. The count describes
what the analysis examined, not what survived reporting — and a count filtered by `--diff` would answer a
question nobody asked while silently failing to answer the one this exists for. A reader comparing a `--diff`
run's single finding against `parts: 28` is reading it correctly.

## Scope

**The mechanism, plus the one rule the field measured.**

Three sibling rules — `architecture/reserved-directory-names`, `architecture/directory-naming` and
`architecture/unit-entry-file` — are glob-configured the same way and carry the same blindness. They are
deliberately **not** in this spec. Each needs its own decision about what "examined" means for it and its own
tests, and doing one first tells us whether the label shape generalises before it is stamped onto four rules.
Recorded below rather than forgotten.

**JSON only. No `--stats` flag.** The charter named a flag; the readers are a CI job and a person running
`--reporter json`, both of which read the report. A console surface raises its own questions — where it prints,
how it interacts with `--verbose` and the grouped default output, whether it survives `--score` — and none of
them need answering to close the gap that was measured. Recorded as deferred, not rejected.

## Testing

1. **A declaration that judged directories reports the count**, on a fixture with a known number of them —
   assert the number, not merely its presence.
2. **A live but unoccupied declaration reports `0`**, and produces no finding and no diagnostic. This is the
   pair that the field could not distinguish without planting a violation, so both halves belong in one test.
3. **A declaration that judged directories and rejected them counts them too.** The count is places judged, not
   places permitted; an implementation counting only the permitted ones passes test 1 if its fixture has no
   violations.
4. **The label matches the diagnostic's.** One fixture with a bad declaration and a good one: the string naming
   the bad declaration in the aggregated finding must appear verbatim as a key in `examined`. Nothing else pins
   that they cannot drift.
5. **A rule that counts nothing has no `examined` key**, and the report parses for a consumer that does not know
   the field.
6. **Every `runRules` caller carries the counts.** Three call sites; assert by enumerating them, not by
   sampling. The CLI's `analyzeProject` must surface it the way it already surfaces `ruleIds`, which exists for
   the same "did it run?" reason.
7. **`--diff` does not narrow the count.** A run whose results are filtered to one finding still reports the
   full count. This is the decision most likely to be "simplified" later by someone who assumes the count should
   track the output.

## Release

`@svelte-vitals/core` **minor** — `runRules`'s return type changes and `RuleContext` gains an optional member.
`svelte-vitals` and `@svelte-vitals/vite` **minor**, as the packages that ship it.

## Deliberately not solved

- **The three sibling directory rules.** Same gap, same fix, separate specs — see Scope.
- **A console surface.** Deferred, with the open questions named above.
- **Counting for rules that are not glob-configured.** The sink is generic, but nothing else uses it yet and
  nothing should be given a count without a reader who wants it.
- **Making zero a finding.** Explicitly rejected: it is the state 0.42.0 decided to keep silent, and the
  recommendation attached to such a finding would tell an author to delete a correct declaration.
