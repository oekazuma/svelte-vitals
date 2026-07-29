# architecture/directory-naming — design

**Date:** 2026-07-29
**Status:** approved
**Charter row:** M2 — directory-name casing per location (L3)
**Depends on:** the source-file inventory shipped with `architecture/unit-entry-file`
(`2026-07-28-unit-entry-file-design.md`)

## The problem

A project decides that a directory's name carries meaning: PascalCase means a component unit,
camelCase means a grouping or a route segment, kebab-case means a URL path segment under an API
directory. Nothing enforces it. The convention lives in a document, and every new directory is a fresh
chance to disagree with it silently.

The failure is quiet in a specific way. A mis-cased directory compiles, type-checks, renders, and
passes every test. It costs nothing today and everything later, when the name stops being a reliable
signal and the reader — human or agent — has to open the directory to learn what it is.

## Where it sits

M2 is the charter's second L3 mechanism and the third rule to consume the source-file inventory. It
clears the four gates as follows.

**Mission fit.** Directory naming is not a code-health metric in the abstract; it is one only when a
project has declared what its names mean. That is what makes it L3. Inert until declared, it asserts
nothing on a project that has no such convention.

**Precision.** The hazards are enumerated below and each has a decision: SvelteKit route syntax is
decoded rather than flagged, containers named by SvelteKit itself are never checked, and a location
that legitimately admits two casings can say so.

**Actionability.** The remedy is always "rename the directory, or narrow the declaration that governs
it". Which one is right is the author's call, and the finding gives the direction rather than naming a
canonical fix — the latitude the charter grants `architecture/component-size`.

**Default stance.** Off. New rules land at `info`, and this one emits nothing at all until
`directories` is set.

## Evidence

The convention document this design was validated against states, for a production SvelteKit app:

- A PascalCase directory is a component unit and must hold a same-named `.svelte` (M1's territory).
- A directory that cannot hold a same-named file is camelCase.
- Page route segments are camelCase (`hallList`, `agreementUse`).
- Endpoint segments under the internal-API directory are kebab-case (`recommend-halls`,
  `set-cookie`), while function units below them are camelCase again (`set-cookie/fetchSetCookie/`).
- Directories directly under the features and API roots are camelCase.

Two facts about that list drive the whole design. **The same tree wants different casings at
different depths**, so a declaration must be able to narrow another one. And **one location
legitimately admits two casings** — a route's `components/` directory holds PascalCase units and
camelCase groupings side by side — so a single case per glob cannot describe it.

The same project already lints directory casing, and what its configuration can and cannot say is the
sharpest evidence for this rule.

It carries **two** directory-casing entries — the features root and the API root, both camelCase —
which are exactly two of the four declarations in the example below. So M2 is not filling a void; it
is replacing a check that exists but is confined to a one-level glob, cannot decode route syntax, and
cannot name two acceptable casings for one location. Those three limits are why the convention's route
and `components/` rules are unlinted today, and each is a design decision below.

Its **filename** entries are a different matter, and they confirm the charter's split. Five of the six
assert "the filename equals an ancestor directory's name" — M1 seen from the file side — and the
sixth forbids specific filenames in a location, which is M10. **No filename entry governs casing**, so
**M2 governs directory names only.**

## Design

### Identity

|               |                                 |
| ------------- | ------------------------------- |
| id            | `architecture/directory-naming` |
| category      | architecture                    |
| severity      | `info`                          |
| scope         | `component`                     |
| fact consumed | `RuleContext.sourceFiles`       |

### Options

| Option        | Kind          | Default | Meaning                                           |
| ------------- | ------------- | ------- | ------------------------------------------------- |
| `directories` | `string-map`  | `{}`    | directory glob → the set of casings allowed there |
| `exclude`     | `string-list` | `[]`    | remove a directory and everything beneath it      |

A value names one casing, or several joined by `|`:

```js
// svelte-vitals.config.js
export default {
  rules: {
    'architecture/directory-naming': {
      options: {
        directories: {
          'src/routes/**': 'camelCase|PascalCase',
          'src/routes/svelteApi/*': 'kebab-case',
          'src/lib/features/*': 'camelCase',
          'src/lib/api/*': 'camelCase'
        }
      }
    }
  }
};
```

### The casing vocabulary

Four names, each a test of the whole string rather than of its first character:

| Name         | Accepts                    |
| ------------ | -------------------------- |
| `camelCase`  | `^[a-z][a-zA-Z0-9]*$`      |
| `PascalCase` | `^[A-Z][a-zA-Z0-9]*$`      |
| `kebab-case` | `^[a-z0-9]+(-[a-z0-9]+)*$` |
| `snake_case` | `^[a-z0-9]+(_[a-z0-9]+)*$` |

`snake_case` is in the vocabulary for completeness rather than on evidence — nothing in the convention
document declares it. It costs one regex, and leaving it out would not reduce what the rule detects:
`fair_summary` is already reported under a `camelCase` declaration whether or not `snake_case` is
nameable. What it buys is the ability of a project that _wants_ snake_case directories to say so.

Testing the whole string is what makes the vocabulary useful: it is the difference between
distinguishing `recommend-halls` from `recommendHalls` and merely observing that both start with a
lowercase letter. A first-character test — which is what `architecture/unit-entry-file` uses
internally — cannot express the endpoint convention at all.

**The two rules therefore mean different things by "PascalCase", and that is deliberate.** M1 asks
only whether a directory looks like a unit, and answering that with the first character keeps it from
refusing to check a unit because its name has an underscore in it. M2 asks whether a name conforms,
which is the stricter question. Both rule pages state their own definition rather than referring to
"PascalCase" as if it were one shared idea.

**A single lowercase word satisfies `camelCase`, `kebab-case` and `snake_case` at once.** `fair`
matches all three. This is correct — there is nothing in the name to disagree with — and it is worth
documenting, because it means M2 catches less than a reader might expect.

**A name with no letter in it is skipped.** `2024`, `404` and `123` carry no casing at all, so no
casing claim can be made about them — the same reason the compound route segments below are skipped.
The regexes alone would not do this: `^[a-z][a-zA-Z0-9]*` requires a leading letter, so `2024` fails
`camelCase` and `PascalCase` while passing `kebab-case` and `snake_case`, and a year-archive route
under a `camelCase|PascalCase` declaration would be reported for a name the project cannot rename
without changing its URL. That is the actionability gate failing, and it is the same objection the
trailing-`/**` guard answers for `src/routes` itself.

The line is drawn at **contains no ASCII letter**, not at "starts with a digit". `2024archive` does
contain letters, is not camelCase by any reading, and can be renamed, so it is reported.

Together these give the rule's reach: **it fires only on a name that contains a letter and carries the
evidence of a casing it does not satisfy** — a capital, a hyphen, an underscore, a leading digit, or
any character none of the four vocabularies admits at all. That last clause is not padding: `foo.bar`
has no capital, hyphen, underscore or leading digit, yet fails all four regexes and is reported. That
is the right outcome — the name is renameable and the finding is actionable — but the enumeration has
to say so, or it reads as closed when it is not.

### Route syntax is decoded, not flagged

`src/routes/` is full of directories whose names are SvelteKit syntax. Checking those literally would
make `'src/routes/**'` unusable, so the name is decoded to the identifier inside it before the casing
test:

| Directory          | Checked as |
| ------------------ | ---------- |
| `[hallId]`         | `hallId`   |
| `[hallId=integer]` | `hallId`   |
| `[...rest]`        | `rest`     |
| `[[optional]]`     | `optional` |
| `(app)`            | `app`      |

The decoding is defined as an ordered sequence, because the doubled-bracket form has to be recognised
before the single-bracket one or it decodes to `[optional]` and is thrown away:

1. `(x)` → `x`; `[[x]]` → `x`; `[x]` → `x`; otherwise the name unchanged.
2. A leading `...` is dropped.
3. Everything from the first `=` onward is dropped.
4. **If what remains is empty or still contains `[`, `]`, `(` or `)`, the directory is skipped.**

Step 4 is what handles the compound segments SvelteKit allows. `[foo]-[bar]` decodes to `foo]-[bar`
and `x[y]z` decodes to itself; both retain a bracket, and both are skipped. No single identifier is
being named in either, so there is no casing claim the rule could make honestly.

Decoding keys off the shape of the name alone and is not restricted to `src/routes/`. A directory
named `[foo]` outside the routes tree does not occur in practice, so restricting it would add a
condition that prevents nothing.

The consequence to state in the docs: a declaration that reaches into `src/routes/` governs parameter
and group names as well as static segments, under the same casing. A project wanting kebab-case URL
segments but camelCase parameters in the same subtree cannot express that, and should declare the
narrower static-segment globs instead.

### Specificity: how a declaration narrows another

Two declarations can match the same directory. The winner is decided by, in order:

1. **more path segments** in the key;
2. then **fewer `**` segments**;
3. then **the longer key**;
4. then **the lexicographically first** key.

Rule 1 counts wildcard segments too, so `src/*/*/*` outranks `src/routes/**` despite naming nothing
literal. Constraining depth is a form of specificity, so this is defensible, but it is the reverse of
the CSS-like intuition that more literal text means more specific. No realistic key set exhibits it;
the rule page gets a line so a reader who constructs one is not surprised.

Rules 1 and 2 are new. `architecture/unit-entry-file` shipped with rules 3 and 4 alone, and raw
string length inverts specificity whenever `*` and `**` sit at the same position: `src/lib/features/**`
is one character longer than `src/lib/features/*`, so the **broader** key wins and the narrower
declaration silently does nothing. M1's own documented example never exhibits the shape — there the
narrower key is also the longer string — which is why it shipped uncaught.

**This changes `architecture/unit-entry-file`'s documented behaviour.** The change is taken now rather
than documented as a hazard: both rules are `info`, both are inert until declared, both are pre-1.0,
and a specificity metric that inverts under a common glob shape is a defect rather than a convention
worth preserving. The change is additive for every key set where `*` and `**` do not compete —
including M1's documented example, which is covered by a test.

### `exclude`

Identical in meaning to M1's: a directory matching an `exclude` glob, or having an ancestor that
matches one, is removed along with everything beneath it. It outranks every `directories` declaration.

**`exclude` is absent from the example above**, because on the tree this design was validated against
it did nothing: removing it changed no finding. Two reasons overlapped — `tests` and `e2e` are
themselves camelCase, so they never fire under the routes declaration, and the `lib` declarations are
one level deep and never reach a `tests` directory. Documenting a no-op as if it were load-bearing
teaches the reader that `exclude` is routinely needed here, which is false. The rule page shows
`exclude` separately, on an example where it demonstrably removes a finding.

That measurement also **narrows a claim M1 makes and this design inherited.** "An exclusion that
matches nothing fails loudly, by leaving findings you meant to remove" holds only where the subtree
would have produced findings. Where it would not — the case just measured — a mistyped `exclude` glob
is completely silent, and no check here will say so.

Reporting unmatched `exclude` globs is still the wrong fix, and the same measurement is why: an
exclusion that removes nothing has no effect on the report, so a finding about it would be noise about
nothing. The honest move is to state the limit rather than to widen the check, so both the spec and
the rule page carry the qualified form, not the absolute one.

The **opposite** direction is not a limitation and is reported: an `exclude` glob that removes so much
that a `directories` declaration never evaluates anything makes that declaration inert, and inert
declarations are exactly what this rule reports. See "When a key counts as having done work". The
asymmetry is deliberate — an exclusion doing nothing is harmless, an exclusion silently cancelling a
declaration is not.

### Findings

**A violation reports at a file inside the directory**, preferring a direct child and falling back to
the lexicographically first file anywhere beneath it. Not at the directory: `filterToChangedFiles`
keeps only locations git lists as changed, and git never lists a directory, so a directory-keyed
finding disappears from every `--diff` run.

The message names the requirement and not the observed casing:

```
src/routes/svelteApi/setCookie must be kebab-case.
  fix: Rename the directory, or narrow the declaration that governs it.
```

When the declaration allows several casings, the message lists them: `must be camelCase or
PascalCase.`

Naming the observed casing was considered and rejected: `fair` satisfies three of the four names at
once, so "this is kebab-case" is not a statement the rule can make truthfully for every input.

**There are no pass results.** M1 emits one per conforming unit and can afford to, because it keys the
pass on the unit's entry file — for a component unit that is a `.svelte` path already present as a
score key, so it adds nothing to the denominator. M2's subject is the directory itself and has no such
pre-existing key. `computeScore` seeds every distinct `route` at 100 and averages, so a pass per
directory would add hundreds of 100s from a single `'src/routes/**'` declaration and dilute every real
finding in the project. Emitting only violations keeps the score honest.

### Declarations that do not check what they say

One finding, carrying every such key, exactly as M1 does — and for the same reason: `findingKey` is
`id::route::location`, and every project-scoped result here leaves both unset, so N separate findings
would collide into one baseline entry. That constraint is what forces the shapes below into one
finding rather than a tidy finding per failure.

| Failure                                    | Example                                               | Checks nothing?       |
| ------------------------------------------ | ----------------------------------------------------- | --------------------- |
| the glob matched no directory              | `'src/lib/feature/*'` — a typo for `features`         | yes                   |
| every directory it matched is excluded     | `'**/tests/fixtures/*'` under `exclude: ['**/tests']` | yes                   |
| every casing name in the value is unknown  | `'camelcase'`                                         | yes                   |
| _some_ casing name in the value is unknown | `'camelCase\|kebabCase'`                              | no — the rest applies |

Each key is annotated with its own reason, and the lead-in claims only what is true of all four:

```
These declarations do not check what they say:
  'src/lib/feature/*' — matched no directory
  '**/tests/fixtures/*' — matched only excluded directories
  'src/lib/api/*' — unknown casing name 'camelcase', so it checks nothing
  'src/routes/**' — unknown casing name 'kebabCase'; the rest of the value still applies
```

The remedies differ, which is why the annotations exist: a typo in the glob, a contradiction between
two options, a typo in the value that disables the declaration, and a typo in the value that silently
narrows it. A single undifferentiated "checks nothing" would be wrong about the fourth row and would
leave the reader to work out the other three.

The last two are worth explaining. `validateRuleOptions` checks only that a `string-map` value is a
non-empty string; it has no notion of a closed vocabulary, so a mistyped casing name would otherwise
be accepted and then match nothing. Extending the option system with a value vocabulary was considered
and rejected as a larger surface for the same outcome: a mistyped casing name is a declaration not
doing what it says, so it belongs in the finding that already reports those.

The partial case is the more dangerous of the two and is why this finding is not restricted to inert
keys. `'camelCase|kebabCase'` is operative — `camelCase` still governs — so the declaration keeps
working and quietly enforces **less** than it was written to enforce. Nothing else in the run would
ever mention it. An inert-only finding would report the fully mistyped value and stay silent on the
partly mistyped one, which is the wrong way round: the silent narrowing is the harder failure to
notice.

**A key declared only inside an `overrides` entry is not checked here**, inheriting M1's documented
limitation for the same reason — deciding whether it matched anything means intersecting that entry's
scope with the directory set. The rule page says so, as M1's does.

### When a key counts as having done work

**A key is recorded on a match to a directory that survives `exclude`** — after exclusion, before
every other gate.

The two sides of that line are different in kind, and an earlier draft of this spec got it wrong by
putting `exclude` on the same side as the skips.

**The skips do not stop a key counting.** A compound route segment or a letterless name means the key
named the directory, the rule looked at it, and there was nothing it could say honestly. A check ran.
Reporting that as inert would send the reader hunting for a typo that is not there. The same holds for
a key that lost the tie-break: another declaration governed the directory, but this one still
identified it.

**Exclusion does stop a key counting**, because an excluded directory is one the rule was _forbidden_
to look at. A key whose every match is excluded never evaluates anything, ever:

```js
directories: { '**/tests/fixtures/*': 'camelCase' },
exclude: ['**/tests'] // shadows the declaration above completely
```

That is a declaration that checks nothing in the most literal sense, and it is the failure this whole
family of findings exists for. It is also the variant most likely to arise in practice, since an
`exclude` entry added later — during a convention change — can shadow a declaration written months
earlier, and `exclude` merges additively across config layers, so a shared base config can shadow a
project-level declaration without either author seeing both.

The objection that `exclude` is deliberate where a typo is not does not rescue the declaration:
if both entries are deliberate, they contradict each other, and one of the two is wrong.

**`architecture/unit-entry-file` has the same gap and is fixed with it.** Its bookkeeping runs before
its `exclude` check, with a code comment that bundles the excluded case together with the
lost-the-tie-break case as "has still done work". The tie-break half of that reasoning is right and
survives; the excluded half does not. Both rules move to the ordering above through the shared module,
so the two never disagree about what counts as work.

M1's `pascalCaseUnits` keeps its extra condition on top: there the casing gate _is_ the identification
criterion, so a key matching only lowercase directories has identified nothing and stays inert.

#### Telling "matched nothing" from "matched only excluded directories"

Excluded directories are skipped before any key is tested against them, so the main pass cannot
distinguish the first two failures — it never learns that the shadowed key would have matched. **The
classification is a second pass**, and it runs only when there is something to classify:

1. The main pass collects the paths it skipped as excluded. It tests no key against them.
2. If — and only if — some key ended the run with no work recorded, those keys are tested against the
   collected paths. A match means "matched only excluded directories"; no match means "matched no
   directory".

The hot path therefore still never tests a key against an excluded directory, and the second pass
costs nothing in the normal case, because a correct configuration has no unrecorded keys and the pass
does not run at all. When it does run it is a handful of keys against the excluded set, once.

This is the piece the first draft of this section got wrong: it claimed the simplification _and_ the
message resolution without saying where the second came from. They are compatible, but only because
the classification is deferred rather than gathered inline.

### The trailing `/**` guard

A key ending in `/**` means "everything under X" and must not also govern X. `routeGlobToRegExp`
compiles a trailing `/**` to `(/.*)?`, which matches the bare prefix, so the guard is mandatory —
M1 produced three successive false positives from this one compilation detail.

M2 needs it for a stronger reason than M1 did. The bare prefixes of the declarations a project will
actually write are `src/routes`, `src/lib` and `src`, and **those are names SvelteKit chooses, not the
project.** A casing finding against a directory the project cannot rename is pure noise.

As in M1, the prefix is compiled as a glob rather than compared as a string: a key carrying a wildcard
before its trailing `/**` has a prefix no literal directory can ever equal.

## Shared module

`architecture/unit-entry-file` holds roughly eighty lines that M2 needs verbatim: the ancestor-prefix
derivation, the basename helper, the compiled-key type, the match-and-tie-break function, the memoised
compiler with its bare-prefix guard, and the bookkeeping that records which keys did work. M3 will need
the same.

These move to a module shared by the architecture rules. The extraction is not optional bookkeeping —
copying them is how the trailing-`/**` false positive gets rediscovered a fourth time, and both
corrections above have to land in one place or the two rules disagree about which declaration wins and
about which one did any work.

**The exclusion check moves ahead of matching**, which is both the fix from "When a key counts as
having done work" and a simplification: an excluded directory is now skipped before any key is tested
against it, instead of being matched, recorded, and then discarded. The one thing that ordering costs
— the ability to say _which_ of the two silent failures a key hit — is bought back by the deferred
second pass described there, not by matching eagerly.

What remains a caller decision is the identification gate on top. M1 records a `pascalCaseUnits` match
only when the directory's name is PascalCase, because there the casing gate is what identifies a unit
at all; M1's `units` and M2's `directories` record every surviving match. The shared function reports
what matched and what survived exclusion; each rule decides what that means.

Safety comes from M1's existing suite — thirty-odd tests including a regression for each of the three
false positives — staying green across the move, plus new tests for the specificity metric and for
both sides of the bookkeeping line.

## Interaction with `architecture/unit-entry-file`

`src/lib/features/Fair/` under a camelCase declaration draws two findings: M1's "this PascalCase
directory has no `Fair.svelte`" and M2's "this location requires camelCase". Neither suppresses the
other. They are different claims and both are true, and the charter's precision gate is about false
positives, not about overlap. Both rule pages record the pairing so the reader is not surprised by it.

## Deliberately not solved

- **Where a reserved name may appear** — `parts/` only directly under a component unit, and so on.
  That is M4, which waits on a structured-list option kind.
- **A closed vocabulary of reserved directory names** — "these eight names, and updating the table
  before using a ninth". That is M3, the next rule.
- **File names.** No casing convention in the evidence governs them; the filename conventions that do
  exist are M1 and M10.
- **Different casings for static segments and route parameters in one subtree.** Decoding puts both
  under one declaration; a project needing them apart writes narrower globs.
- **Anything outside `src/`.**
- **`--route` runs**, where no inventory is built and the rule is silent — including its
  inert-declaration finding, since a single route says nothing about which declarations did work.

## Testing

1. **Mechanism tests** — each casing name against conforming and non-conforming inputs, the
   single-lowercase-word overlap, the letterless skip and the `2024archive` counter-case,
   route-syntax decoding including the skipped compound shapes, the four-step specificity order with a
   case that inverts under the old metric, the bare-prefix guard, `exclude` subtree pruning, the
   `foo.bar` case that fires on none of the four named evidences, and all three inert-declaration
   failures with their distinct messages.
2. **Bookkeeping tests on both sides of the line**, since this is where M1 has now been wrong twice in
   opposite directions. A key matching only skipped directories, and a key that matched but lost the
   tie-break, must stay **out** of the finding; a key whose every match is excluded must land **in**
   it. The same pair runs against `architecture/unit-entry-file`, whose `units` bookkeeping changes
   with this work.

   **Membership is not enough here — the message is asserted too.** A test that only checks whether a
   key appears would pass with the second pass deleted, since a shadowed key is unrecorded either way
   and would simply be mislabelled "matched no directory". So the two failures are asserted by their
   annotations, in one run that contains both, and the partly-mistyped value is asserted to appear
   **without** the "checks nothing" wording.

3. **A documented-example test.** The configuration example in the rule page is run against a fixture
   tree and asserted to examine directories, to produce the expected findings, and to leave **no** key
   inert. M1's review established this: an example that is merely silent looks identical to an example
   that is wrong, and only a test that asserts what was checked can tell them apart.
4. **A differential test for the `exclude` example**, which the test above structurally cannot cover:
   an unmatched `exclude` glob is never reported, so a no-op exclusion in an example is invisible to an
   inertness assertion. The rule page's `exclude` example is therefore asserted **both ways** — the
   finding present with the exclusion removed, absent with it in place. Review measurement, not
   speculation, put this here: the `exclude` first written into this spec's example changed nothing on
   a real tree, and nothing in the planned tests would have said so.
5. **Regression** — M1's whole suite green across the shared-module extraction, plus a test pinning
   M1's documented example under the new specificity metric.
6. **Wiring** — the rule reaches the `RuleContext` from both the CLI and the vite plugin, following
   the end-to-end tests added for the inventory itself.

## Deliverables

- `packages/core/src/rules/architecture/directory-naming.ts` and the shared declaration module.
- Two behaviour changes to `architecture/unit-entry-file`, both via the shared module and both
  reflected in its rule page: the specificity metric, and bookkeeping moving after `exclude` so a
  fully shadowed declaration is reported as inert.
- Registration in all four places, and the regenerated rule-index pages.
- `docs/src/content/docs/rules/architecture/directory-naming.md` and its Japanese counterpart.
- `configuration.mdx`, English and Japanese.
- A changeset covering the new rule and both behaviour changes to `unit-entry-file`.
- The correction already applied to `2026-07-28-unit-entry-file-design.md`, whose inert-declaration
  section still described the per-key shape that implementation replaced.

## Validation

The example configuration was measured against the tree the convention document governs, in both
directions, before this spec was approved.

| Tree                                | Directories examined | Route segments skipped | Violations |
| ----------------------------------- | -------------------: | ---------------------: | ---------: |
| the convention-compliant branch     |                  157 |                      0 |      **0** |
| the branch predating the convention |                  229 |                      — |      **1** |

The single violation is `src/lib/features/FetchOnMount` under `'src/lib/features/*': 'camelCase'` — a
real deviation that existed before the convention was applied. Zero findings on the compliant tree and
a true positive on the non-compliant one is the pair that matters: either number alone is consistent
with a rule that checks nothing.

Decoding was exercised against the real route tree and every shape resolved as specified, with **no**
segment falling through to the compound-segment skip. The only specificity contest the configuration
actually produces — `src/routes/svelteApi/*` against `src/routes/**` — is settled by rule 1 alone.

Two of this review's three corrections came from measurement rather than reading: the `exclude`
example changed no finding, and the claim that the project had no directory-casing lint was false. The
digit-only gap came from reading the spec's own stated principle against its regexes.
