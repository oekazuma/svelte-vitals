# A count of what a declaration examined — design

**Date:** 2026-08-07
**Status:** approved; reviewed 2026-08-07
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

### The shape in the report — a top-level map, not a field on `rules`

```jsonc
"examined": {
  "architecture/reserved-name-placement": {
    "capitalisedUnitPlacements.parts → src/**": 28,
    "capitalisedUnitPlacements.styleGuide → src/**": 109,
    "anyCaseUnitPlacements.types → src/**": 0
  }
}
```

**Not inside `rules[id]`, and the reason is a scope difference the reporters guide already states:**

> The counts describe the report, not the tree. Baseline, suppression and `--diff` filtering are applied before
> the report is built…

`findings` and `passed` describe **what survived reporting**. This count describes **what the analysis
examined**, and is deliberately unfiltered (below). Putting the two in one object would place two different
scopes behind sibling keys with nothing marking the difference — one field carrying two meanings, which is the
shape that produced the two defects this session already fixed in `AnalyzeOptions.rules`. A top-level map makes
the difference structural. `inventories` is already exactly this shape and lives there for the same reason.

The key is the rule id, then the rule's own label. Absent for rules that count nothing, so no existing consumer
breaks.

**The labels are the ones the diagnostic already uses.** `reserved-name-placement`'s aggregated finding names a
bad declaration as `capitalisedUnitPlacements.parts → src/lib`; the count uses the identical string, verified
verbatim. A reader who sees a declaration named one way in one place and another way elsewhere cannot join
them, and joining them is the whole point — the count is what makes a _silent_ declaration legible next to the
diagnostic that describes a _broken_ one.

### What the number counts, and what zero does and does not mean

**The number of reserved-name directories judged against that declaration.** Not the directories the glob
matches, and not the findings produced: a `parts/` the declaration permitted counts, and so does one it
rejected.

**Zero means the declaration judged nothing. It means nothing more than that**, and an earlier draft of this
design claimed otherwise — that zero meant "live, reachable and currently unoccupied". Review falsified that by
execution with two supported configurations in which zero appears while occupying directories exist. `check()`
reaches its judging phase only past five early exits, and each is a separate reason a count can be zero:

| the directory is skipped because                                                         | the count for the declaration |
| ---------------------------------------------------------------------------------------- | ----------------------------- |
| no map is declared at this directory (the rule is inert here)                            | not incremented               |
| the directory's name is in no map                                                        | not incremented               |
| **any** map's value for that name splits to nothing, which ungoverns the name everywhere | not incremented               |
| the directory is at the root and has no parent                                           | not incremented               |
| the directory is excluded                                                                | not incremented               |

Two of those bite in practice, both produced by execution:

- A global `placements: { parts: '|' }` ungoverns `parts` in **every** map, so a correct
  `capitalisedUnitPlacements.parts` reports `0` beside three real `parts/` directories. The aggregated
  diagnostic does name the empty declaration, so the cause is visible — but in the other map's entry, not this
  one's.
- An `exclude` supplied through an `overrides` layer skips the directories while the diagnostic classifier uses
  the **global** `exclude` only. The count is `0`, and **no diagnostic explains it**. That asymmetry is recorded
  in the rule's own design as deliberate — an overrides layer can only add exclusions, so it can only make the
  diagnostic quieter — and it now makes the count quieter too. Recorded here rather than fixed: changing it
  means reopening a decision made on separate evidence.

So the report states a number and nothing else. **The reader must not be told what zero implies about the
tree**, in the report or the guide, because it does not imply one thing.

### Which declarations are counted

**Only globally resolved ones — the same set the diagnostic classifies.** Options resolve per directory, so an
`overrides` layer can mint a declaration that exists nowhere in the config root; counting it would put keys in
`examined` that no diagnostic can ever name, breaking the join that is this design's whole justification. The
rule already decided that only globally resolved declarations are diagnosed; the count follows that scope
exactly rather than inventing a second one.

The consequence, recorded: judgments made under an override-only declaration are not counted anywhere.

**Empty-value declarations have no key.** Their diagnostic label is `map.name` with no `→ glob`, because there
is no glob to name. They are named by the diagnostic and absent from `examined`, and both claims above — the
label match and the zero — are about **glob-bearing** declarations only.

### It is not filtered

`--diff`, `--baseline` and suppressions narrow **results**. They do not narrow this count, which is why it does
not live beside `findings`. A reader comparing a `--diff` run's single finding against `parts: 28` is reading
both correctly. This holds by construction today — `analyzeProject` runs the rules before `applyScope` — and
the test below exists to keep it that way.

## Scope

**The mechanism, plus the one rule the field measured.**

Three sibling rules — `architecture/reserved-directory-names`, `architecture/directory-naming` and
`architecture/unit-entry-file` — are glob-configured the same way and carry the same blindness. They are
deliberately **not** in this spec. Each needs its own decision about what "examined" means for it and its own
tests, and doing one first tells us whether the label shape generalises before it is stamped onto four rules.
Recorded below rather than forgotten.

**The dev-server hooks drop the counts.** That caller builds no JSON report — it POSTs results to the overlay
ingest — so there is nowhere for a count to go. Named here so "every caller carries them" is not read as a
claim about all three.

**JSON only. No `--stats` flag.** The charter named a flag; the readers are a CI job and a person running
`--reporter json`, both of which read the report. A console surface raises its own questions — where it prints,
how it interacts with `--verbose` and the grouped default output, whether it survives `--score` — and none of
them need answering to close the gap that was measured. Recorded as deferred, not rejected.

## Testing

1. **A declaration that judged directories reports the count**, on a fixture with a known number of them —
   assert the number, not merely its presence.
2. **A live but unoccupied declaration reports `0`**, and produces no finding and no diagnostic. This is the
   pair the field could not distinguish without planting a violation, so both halves belong in one test.
3. **A declaration that judged directories and rejected them counts them too.** The count is places judged, not
   places permitted; an implementation counting only the permitted ones passes test 1 whenever its fixture has
   no violations.
4. **The label matches the diagnostic's**, on a **glob-bearing** declaration. One fixture with a bad
   declaration and a good one: the string naming the bad declaration in the aggregated finding must appear
   verbatim as a key in `examined`. The fixture must not use an empty value for the bad declaration — those
   carry no glob and therefore no key, so the test would be unimplementable as worded.
5. **A rule that counts nothing has no entry**, and the report parses for a consumer that does not know the
   field.
6. **A run with no file inventory reports no counts at all** — not a map of zeros. `--route` runs pass
   `sourceFiles: undefined` and the dev-server hooks pass none, and the rule returns before its config guard in
   that case. An implementation that seeds the sink at the top of `check()` emits `0` for every declaration on a
   run that examined nothing, which is precisely the lie this feature exists to remove — **and every other test
   here passes on that implementation**, because none of them runs the rule without an inventory.
7. **The two report-producing callers carry the counts**, asserted by enumerating the call sites rather than
   sampling one. The dev-server hooks build no JSON report — they POST results to the overlay ingest — so
   nothing to assert there; that caller is named in the spec as deliberately dropping the counts, not as
   covered.
8. **An override-only declaration is not counted**, and a directory judged under one does not inflate a global
   declaration's number. This is the scope decision above, and no other test touches `overrides`.
9. **`--diff` does not narrow the count.** A run whose results are filtered to one finding still reports the
   full count. This is the decision most likely to be "simplified" later by someone who assumes the count should
   track the output.
10. **An empty value zeroes the name's other declarations**, matching the enumerated exit above. This is one of
    the two zero-causes review produced by execution, and pinning it stops a later reader from "fixing" the
    count to ignore sibling maps.

## Release

`@svelte-vitals/core` **minor**, `svelte-vitals` and `@svelte-vitals/vite` **minor** as the packages that ship
it. The changeset must name every changed exported type, not only the behaviour: `runRules`'s return shape,
`RuleContext`'s new optional member, and `JsonReport`'s new top-level `examined` map. `RuleEvidence` is
unchanged — the count deliberately does not go there.

## What changes outside the code

`docs/src/content/docs/guides/(reporting)/reporters.md` and its Japanese counterpart document the `rules` map
today, **including the exact indistinguishability this feature addresses**: "Presence in `rules` proves a rule
wasn't excluded by `--ignore`, `--rules`, `--category`, or config's top-level `rules`; it does not prove
`overrides` left anything for it to find." Both pages gain the `examined` map, and — the part that matters —
the sentence "The counts describe the report, not the tree" must be scoped to `rules`, since `examined` is the
one count in the report that describes the analysis instead.

## Deliberately not solved

- **The three sibling directory rules.** Same gap, same fix, separate specs — see Scope.
- **A console surface.** Deferred, with the open questions named above.
- **Counting for rules that are not glob-configured.** The sink is generic, but nothing else uses it yet and
  nothing should be given a count without a reader who wants it.
- **The two zero-causes that carry no explanation.** A sibling map's empty value, and an `overrides`-supplied
  `exclude`. Both are enumerated above; neither is fixed here. The second in particular leaves a `0` with no
  accompanying diagnostic, and closing it means reopening the rule's recorded decision that only globally
  resolved declarations are diagnosed — a decision made on separate evidence and not re-litigated by this
  design.
- **Documenting what zero implies about the tree.** There is no single implication, so neither the report nor
  the guide states one. The guide must say what the number counts and stop.
- **Making zero a finding.** Explicitly rejected: it is the state 0.42.0 decided to keep silent, and the
  recommendation attached to such a finding would tell an author to delete a correct declaration.
