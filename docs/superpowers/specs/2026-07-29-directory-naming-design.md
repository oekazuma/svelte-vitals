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

The same project's filename-linter configuration was examined for casing rules and has none: four of
its six filename entries assert "the filename equals an ancestor directory's name", which is M1 seen
from the file side, and the remaining one forbids specific filenames in a location, which is M10.
This confirms the charter's split — **M2 governs directory names only.**

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
        },
        exclude: ['**/tests', '**/e2e']
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
documenting, because it means M2 catches less than a reader might expect. It only ever fires on a name
that contains the evidence of its own casing: a capital, a hyphen, an underscore.

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
`exclude` globs are never reported as unmatched, for the reason M1 gives — an exclusion that matches
nothing already fails loudly, by leaving findings you meant to remove.

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

### Declarations that check nothing

One finding, carrying every such key, exactly as M1 does — and for the same reason: `findingKey` is
`id::route::location`, and every project-scoped result here leaves both unset, so N separate findings
would collide into one baseline entry.

Two failures land in it:

| Failure                                  | Example                                       |
| ---------------------------------------- | --------------------------------------------- |
| the glob matched no directory            | `'src/lib/feature/*'` — a typo for `features` |
| the casing name is not in the vocabulary | `'camelcase'`, `'kebabCase'`, `'CamelCase'`   |

The second is worth explaining. `validateRuleOptions` checks only that a `string-map` value is a
non-empty string; it has no notion of a closed vocabulary, so a mistyped casing name would otherwise
be accepted and then match nothing, leaving the declaration silently inert — the precise failure this
family of findings exists to surface. Extending the option system with a value vocabulary was
considered and rejected as a larger surface for the same outcome: a mistyped casing name _is_ a
declaration that checks nothing, so it belongs in the finding that already says so.

A key whose value names several casings is inert only if **every** name in it is unknown; one valid
name makes the declaration operative, and the unknown ones are reported so the typo is still visible.

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
copying them is how the trailing-`/**` false positive gets rediscovered a fourth time, and the
specificity fix above has to land in one place or the two rules disagree about which declaration wins.

The bookkeeping stays a caller decision. M1 records a `units` match unconditionally but records a
`pascalCaseUnits` match only when the directory's name is PascalCase, because there the casing gate is
the identification criterion. M2 records unconditionally. The shared function reports what matched;
each rule decides what that means.

Safety comes from M1's existing suite — thirty-odd tests including a regression for each of the three
false positives — staying green across the move, plus new tests for the specificity metric.

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
   single-lowercase-word overlap, route-syntax decoding including the skipped compound shapes, the
   four-step specificity order with a case that inverts under the old metric, the bare-prefix guard,
   `exclude` subtree pruning, and both inert-declaration failures.
2. **A documented-example test.** The configuration example in the rule page is run against a fixture
   tree and asserted to examine directories, to produce the expected findings, and to leave **no** key
   inert. M1's review established this: an example that is merely silent looks identical to an example
   that is wrong, and only a test that asserts what was checked can tell them apart.
3. **Regression** — M1's whole suite green across the shared-module extraction, plus a test pinning
   M1's documented example under the new specificity metric.
4. **Wiring** — the rule reaches the `RuleContext` from both the CLI and the vite plugin, following
   the end-to-end tests added for the inventory itself.

## Deliverables

- `packages/core/src/rules/architecture/directory-naming.ts` and the shared declaration module.
- The specificity fix applied to `architecture/unit-entry-file` via the shared module, with its rule
  page updated.
- Registration in all four places, and the regenerated rule-index pages.
- `docs/src/content/docs/rules/architecture/directory-naming.md` and its Japanese counterpart.
- `configuration.mdx`, English and Japanese.
- A changeset covering the new rule and the behaviour change to `unit-entry-file`.
