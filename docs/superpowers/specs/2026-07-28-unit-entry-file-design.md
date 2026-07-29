# `architecture/unit-entry-file` — Design

Date: 2026-07-28
Status: Approved

## Problem

`2026-07-28-architecture-charter-design.md` records **M1** — "unit directory ↔ same-named entry
file" — as the mechanism behind a family of naming conventions, and notes that M1, M2 and M3 share
one prerequisite: the analyzer cannot see files that are not Svelte components. This spec builds
that prerequisite and the first rule on top of it.

The convention it checks, stated generally: **a directory that declares itself a unit must contain a
file named after it.** A project instantiates that with its own declarations — where its unit
directories are, and what extension each kind's entry file carries.

### What this closes that a filename linter cannot

A project already enforcing directory and file naming through hand-written glob patterns gets a
useful subset today: given a path, does its filename match its parent directory's name. The shape it
cannot express is the one that matters most here — **"this directory is missing a file"**. A check
that validates a file against its own path can never fire for a file that does not exist. That is
exactly the case for the central convention:

> A PascalCase directory must contain a same-named `.svelte`. A directory that cannot have one must
> be camelCase.

Two further gaps follow from the same limitation, and are addressed here:

- A glob that matches nothing silently checks nothing. Every convention costs one or more
  hand-written glob entries, and a tree that grows a level silently drops out of coverage with no
  error. This rule reports a declaration that matched no directory (see "Finding shapes").
- The identifier for a component unit is its **name's casing**, not its position, and units nest to
  arbitrary depth inside `parts/` and grouping directories. A path glob cannot express "any
  PascalCase directory" — `routeGlobToRegExp` treats everything but `*` and `**` as literal, so a
  character class is not available.

Layer **L3**: the convention is declared, never inferred. The rule is inert until the project
declares its units.

## Rule identity

| Field    | Value                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| id       | `architecture/unit-entry-file`                                                                                                              |
| category | `architecture`                                                                                                                              |
| severity | `info` — the landing severity every new rule takes (charter, release contract)                                                              |
| scope    | `component` — findings are file-located. Nothing in the codebase branches on `Rule.scope`; of the three existing values this is the closest |
| layer    | L3 — inert until declared                                                                                                                   |

## Configuration

Three options. Two declare what a unit is; the third declares what is never one. A project that
sets none of them gets no output at all.

| Option            | Kind          | Default | Meaning                                                               |
| ----------------- | ------------- | ------- | --------------------------------------------------------------------- |
| `units`           | `string-map`  | `{}`    | Directory glob → the entry file's extension. Identified by **path**   |
| `pascalCaseUnits` | `string-map`  | `{}`    | Root glob → the entry file's extension. Identified by **casing**      |
| `exclude`         | `string-list` | `[]`    | Directory globs that are never units, pruned with their whole subtree |

```js
// svelte-vitals.config.js
export default {
  rules: {
    'architecture/unit-entry-file': {
      options: {
        units: {
          'src/lib/api/**/*': '.ts', // fetch units and their nested helpers, never the domain level
          'src/**/functions/*': '.ts',
          'src/**/functions/*/*': '.ts', // a helper nested inside a function unit
          'src/**/stores/*': '.svelte.ts'
        },
        pascalCaseUnits: { 'src/**': '.svelte' },
        exclude: ['**/tests', '**/styleGuide', '**/types', '**/e2e']
      }
    }
  }
};
```

### Glob semantics, and why the keys above look the way they do

The declarations compile through `routeGlobToRegExp` (`packages/core/src/config-apply.ts`), whose two
star forms are **not** symmetric. Measured by running the compiler, 2026-07-28:

| Glob                    | Compiles to                      | Matches                                                                 |
| ----------------------- | -------------------------------- | ----------------------------------------------------------------------- |
| `src/lib/api/**/*`      | `^src/lib/api/.*/[^/]*$`         | `{domain}/{fetch}` and `{domain}/{fetch}/{helper}` — **not** `{domain}` |
| `src/lib/api/*/**/*`    | `^src/lib/api/[^/]*/.*/[^/]*$`   | `{domain}/{fetch}/{helper}` **only** — misses every plain fetch unit    |
| `src/**/functions/*`    | `^src/.*/functions/[^/]*$`       | a unit directly under `functions/`                                      |
| `src/**/functions/*/*`  | `^src/.*/functions/[^/]*/[^/]*$` | a helper nested one level deeper                                        |
| `src/**/functions/**/*` | `^src/.*/functions/.*/[^/]*$`    | the nested helper **only** — misses the function unit itself            |
| `src/**/functions/**`   | `^src/.*/functions(/.*)?$`       | everything under `functions/` **and the container itself**              |

Two rules follow, and they are the whole reason the keys are shaped as they are:

1. **A `**` between two segments matches one segment or more — never zero.** So `src/lib/api/**/*`
   requires at least two levels below `api/`, which is exactly why the domain level is never a unit
   candidate and needs no exclusion.
2. **A trailing `/**` matches zero or more**, so it also matches the bare prefix — which is why
   `src/**/functions/**` would sweep in the `functions/` container and must not be used here.

Rule 1 also means a `**` in the middle needs a segment on each side: `src/**/functions/*` does not
match a `functions/` sitting directly under `src/`. A project with one there declares it separately.

An earlier draft of this example used `src/**/functions/**/*`, which under rule 1 matches **only**
nested helpers and checks no function unit at all. `src/lib/api/*/**/*` fails the same way at the
fetch-unit level. Both were verified against the compiler rather than reasoned about, and the
example above is what survived.

### Why two declarations rather than one

The two kinds of unit are identified by genuinely different means, and neither subsumes the other:

- **camelCase directories are ambiguous by design.** The convention allows a camelCase directory to
  be a unit (`{name}/{name}.ts`) _or_ a grouping (no entry file at all). Casing cannot decide which,
  so these units must be identified by position.
- **PascalCase directories are unambiguous, but positionally unbounded.** They nest arbitrarily
  inside `parts/` and grouping directories, so position cannot identify them, while casing can.

Collapsing both into one map would mean inferring the identification style from the key's shape —
implicit, and wrong the first time a key is ambiguous. Two options keep each declaration's meaning
on its face.

All three use existing option kinds, so this ships without waiting on the second rule-options
iteration. Merge semantics are additive — per-key override for the maps, append for the list — so an
`overrides` entry can add or re-point a declaration per path.

### Why `exclude` exists

`units` alone cannot express a project's real unit set. Run against a real tree (2026-07-28): the
two-level glob `src/lib/api/*/*` matched most unit directories but **missed the ones nested a level
deeper**, because that convention puts a helper unit inside the unit that owns it. Widening to
`src/lib/api/**/*` finds those — and also sweeps in every `tests/` directory in the same subtree,
one false positive each, since `tests/tests.ts` is not supposed to exist.

So a `units` glob must be able to say what it is _not_. `routeGlobToRegExp` treats everything but
`*` and `**` as literal, so a negation inside the pattern is unavailable. Two alternatives were
considered and rejected:

- **Implicitly exempting a set of reserved names** (`tests`, `styleGuide`, `parts`, …). This puts a
  project's vocabulary inside the rule, which contradicts L3 — the vocabulary is exactly the sort of
  thing a project declares. It also forbids any project from ever naming a _unit_ `functions`.
- **Adding negation to `routeGlobToRegExp`.** That compiler is shared with `route:` / `files:`
  override matching, so changing its semantics would change how every override matches. Too large a
  blast radius for one rule's need.

`exclude` prunes: a directory is exempt when **it or any ancestor** matches an `exclude` glob, so a
nested `tests/fixtures/` drops out with its parent. It applies to both identification kinds.

### What may go in `exclude` — and what must not

Because it prunes the subtree, **`exclude` may only name a directory that is neither a unit itself nor
holds units beneath it.** Reserved directory names split into two kinds, and only one is excludable:

| Reserved name                | In `exclude`? | Why                                                   |
| ---------------------------- | ------------- | ----------------------------------------------------- |
| `tests`, `styleGuide`, `e2e` | **Yes**       | Hold files, never units                               |
| `types`                      | **Yes**       | Holds split type files, never units                   |
| `parts`                      | **No**        | Its children **are** PascalCase units                 |
| `functions`, `stores`        | **No**        | Its children are exactly what a `units` glob declares |

Excluding a container is self-defeating, and observably so. Against the same real tree (2026-07-28),
an earlier draft of this spec's example added `**/parts`, `**/functions` and `**/stores` to `exclude`.
It removed the `tests/` directories as intended — and also **a third of the PascalCase units**
(everything under a `parts/`) plus every function and store unit, silencing the very declarations
`units` had just made. Dropping those three entries removes the `tests/` directories with **zero**
collateral. The list in the example above is the corrected one.

A related trap has no `exclude` answer: if a broad `units` glob reaches a _container_ directory —
`src/lib/api/**/*` would match an api unit's `functions/` — the container itself becomes a unit
candidate and is reported for the entry file it should not have. The fix is to narrow that `units`
glob, **not** to exclude the container, since excluding it would take the units inside with it.

The excludable half of this list is the same vocabulary M3 (reserved directory names) will take, so
the two stay consistent when M3 lands — but M3 will need both halves, since its claim is about which
names may appear at all rather than which are units.

The discovery behind this: `pascalCaseUnits` works because casing is a position-independent
identifier, but **camelCase units are not fully identifiable by position either** — the exclusion is
what closes the gap.

### Precedence

1. If the directory or any ancestor matches an `exclude` glob, it is never a unit. `exclude` outranks
   both declarations.
2. If any `units` key glob matches the directory, its extension is expected. **When several match,
   the longest key wins** — the most specific declaration. **Among keys of equal length, the
   lexicographically first wins.**
3. Otherwise, if the directory's basename begins `A`–`Z` and any `pascalCaseUnits` key glob matches,
   that extension is expected. Reaching this step only when step 2 found nothing is what makes an
   explicit path declaration outrank the naming convention — there is no separate precedence rule.
4. Matching neither leaves the directory unchecked.

The equal-length tie-break is lexicographic rather than declaration order because additive merging
across config layers (defaults, `rules`, each `overrides` entry) makes key insertion order
unintuitive. Reporting the tie as a configuration error was considered and rejected: it cannot be
detected when the config loads, because deciding whether two keys collide needs the file tree, and it
would add a fourth finding shape. Note the tie-break only changes anything when the two keys carry
**different** extensions — which is itself a configuration smell, and the rule page says so.

`PascalCase` means **the basename's first character is `A`–`Z`**. That is the whole definition:
`PageHeader` qualifies; `searchForm`, `parts` and `[itemId=integer]` do not.

## The fact

`RuleContext` gains `sourceFiles?: string[]` — every file under `src/`, as project-relative POSIX
paths, sorted.

Collection is `collectSourceFiles(rt, cwd)` in `packages/core`, one `rt.glob('src/**/*', cwd)`. It
follows `collectComponentFacts` / `collectKitModuleFacts` exactly, and the Vite package calls the
same core implementation through the Node runtime adapter it already has. **Directories are derived
from path prefixes** — no second glob.

Wired at the two places that assemble a full `RuleContext`: the CLI's `analyzeProject`
(`packages/cli/src/index.ts`) and the Vite build path (`packages/vite/src/analyze.ts`). It is
**absent** in the dev server's live per-request layer (`packages/vite/src/hooks/handle.ts`) and in
the CLI's `--route` mode, which already omit `components` for the same reason — the rule stays
silent there.

Cost is one extra traversal of `src/`, paths only, no file reads. The existing component collector
already walks the same tree _and reads every `.svelte` file_, so this is the cheaper of the two
passes.

The prefix-to-directory derivation stays a module-private helper in the rule file. When M2 and M3
land and need the same derivation, moving it to a shared location is trivial; doing it now would be
speculative.

## Verdict

1. `sourceFiles` absent → no results.
2. Derive the directory set: **every ancestor path prefix of every file**, not only the directories
   that have a file as a direct child. `src/lib/api/item/fetchItem/fetchItem.ts` contributes `src`,
   `src/lib`, `src/lib/api`, `src/lib/api/item` and `src/lib/api/item/fetchItem` — so a directory
   holding nothing but subdirectories **is** in the set and **is** checked. Deriving instead from
   "parents of files" would leave structurally identical directories checked or unchecked depending
   on whether one of them happens to hold a shared file, which is a difference the convention does
   not make.
3. For each directory, resolve options against the target `{ route: dir, file: dir }` — the same
   convention `componentRule` uses, so a `files:`-scoped override reaches it. Compiled globs are
   memoised on the resolved option values, since a project has a handful of distinct declarations
   and thousands of directories.
4. Apply the precedence above to get the expected extension, or skip.
5. The directory conforms when `${dir}/${basename(dir)}${ext}` is in the file set.

## Precision — what the rule stays silent about

| Input                                              | Behaviour                     | Why                                                          |
| -------------------------------------------------- | ----------------------------- | ------------------------------------------------------------ |
| `sourceFiles` absent                               | No results                    | Dev live layer and `--route` mode, as with `components`      |
| `units` and `pascalCaseUnits` both empty           | No results                    | L3 inertness                                                 |
| A directory matched by neither declaration         | Skipped                       | Not declared                                                 |
| A directory whose basename does not begin `A`–`Z`  | Skipped for `pascalCaseUnits` | `parts`, `searchForm`, `[itemId=integer]`                    |
| A directory or ancestor matching an `exclude` glob | Skipped, subtree included     | Declared never to be a unit                                  |
| A directory with no file anywhere beneath it       | Not in the set at all         | Nothing contributes its prefix; git does not track it either |

### The one false positive the convention itself invites

A convention may mirror source paths into a non-source tree — for instance an asset directory that
reproduces `src/` paths verbatim, PascalCase segments included. Those PascalCase directories legitimately
contain no `.svelte`.

Collecting only `src/` prevents this for a mirror that lives **outside** `src/` — such a tree never
enters the directory set at all. It does **not** prevent the same shape when the mirror lives
**inside** `src/` (an asset tree under `src/lib/assets/`, say) or when a route directory happens to
be PascalCase (`src/routes/FAQ/`): both sit inside the collected tree, and a broad `pascalCaseUnits`
root like `src/**` reaches them the same as it reaches a real component unit. Those in-`src/` cases
are not structurally excluded; closing them is the project's job, done with the root glob and
`exclude` — narrow the `pascalCaseUnits` root, or add the offending tree to `exclude`. For a route
segment specifically, the fix is never to rename the directory, since that changes the site's URL.
The rule page states that a root outside `src/` is neither supported nor needed, and now also
carries this narrowing guidance.

### Case-insensitive filesystems

On a case-insensitive filesystem, `Card/card.svelte` exists on disk under that exact name, and the
glob returns it as written, so the lookup for `Card.svelte` misses and the directory is reported.
**That verdict is correct** — the convention requires the directory and file names to match — and it
is pinned by a test so the behaviour is not mistaken for a bug later.

## Finding shapes

Three kinds.

### 1. Violation — the entry file is missing

`route` and `location` are a file, not the directory: `filterToChangedFiles`
(`packages/cli/src/changed-files.ts`) keeps only results whose `location` is in the changed-file set,
and a directory never appears in git's changed-file list — so a directory location would make the
finding invisible in exactly the run meant to catch it. This violation appears when someone creates
`Card/` containing only `Badge.svelte`, and that file _is_ in the changed set.

Which file: **the lexicographically first file directly inside the directory, falling back to the
first file anywhere under it.** Preferring a direct child keeps the finding near the directory it is
about — pointing three levels down at `Card/parts/Foo/Foo.svelte` for a problem with `Card/` reads
badly. The fallback covers a directory holding only subdirectories; since a directory is in the set
only because some file sits under it, one always exists.

No `line`. The message names both the directory and the expected file.

`Fix` carries **no `snippet`**, and the description depends on which declaration matched, because the
remedies differ. `Rule.fix` holds the generic direction — "make the directory and its entry file
agree, or stop declaring this directory a unit" — which is what `explain_rule` shows; each finding
carries the specific one on `Result.fix`:

| Matched by        | `Fix.description`                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `units`           | Add `{name}{ext}` to this directory, or remove it from the `units` declaration.          |
| `pascalCaseUnits` | Add the same-named entry file, or rename the directory to camelCase if it is a grouping. |

Splitting them matters: a `units` match like `functions/getFoo/` is **already** camelCase, so telling
its author to rename it would be nonsense. More than one remedy is valid in both rows, so each gives
the direction rather than naming one as canonical — the latitude the charter's actionability gate
grants `architecture/component-size`.

### 2. Pass — the unit conforms

`route` is **the expected entry file**, which exists by definition here. No `location`, matching
`componentRule`'s passing results so `filterToChangedFiles` can drop the seed.

This choice is what keeps scoring honest. `computeScore` seeds every distinct `route` at 100 and
averages, so a pass keyed on the _directory_ would add one 100 per conforming unit and dilute every
real finding in the project. Keyed on the entry file, a component unit's pass lands on a `.svelte`
path that is **already** a score key, so it adds nothing. A function or store unit's `.ts` entry does
add one key; those are far fewer, and a malformed unit becoming its own scoring subject is defensible.

### `route` means a different file in the two shapes

A violation keys on some file in the unit; a pass keys on the unit's entry file. **Both are real
paths** — the violation's file comes from the inventory, and the pass's entry file exists by
definition — and no consumer treats `route` as something to read: the console reporter groups and
prints it, the agent reporter prefers `location ?? route`, and `computeScore` uses it only as a map
key. Verified 2026-07-28.

One consequence is worth recording. `findingKey` (`packages/cli/src/baseline.ts`) is
`id::route::location`, so a violation's baseline identity depends on which file was chosen. **Adding a
file that sorts earlier inside the directory changes the key, and the unchanged violation looks new.**
The failure direction is safe — a stale violation resurfaces rather than slipping through — but it is
a real fragility, shared with any rule whose location is derived rather than intrinsic.

### 3. Inert declaration — a key matched no directory

**One finding carrying every** option key that matched no directory at all, as a **project-scoped**
result: no `route`, no `location`, `presence: 'none'`. A declaration that checks nothing is a
configuration problem, not a file's problem.

_Corrected 2026-07-29._ This section originally specified one finding **per** key. Implementation
found the collision that forbids it: `findingKey` (`packages/cli/src/baseline.ts`) is
`id::route::location`, and every shape here leaves `route` and `location` unset, so N per-key findings
collapse to one baseline entry — suppressing one inert key would silently suppress every later one.
This rule is the first in the repository to emit more than one project-scoped result per run, so the
collision had no precedent to warn about it. Folding them removes it without touching the shared
baseline and suppression code, and makes suppression one decision rather than N. The shipped rule and
its documentation have always matched the corrected text; only this paragraph was stale.

This is the failure mode that motivated moving these checks here at all, so the rule reports it
rather than leaving the user to wonder whether their globs took effect.

**Limitation, deliberate:** only the globally resolved options
(`config.rules['architecture/unit-entry-file'].options`) are checked for inertness. A key declared
solely inside an `overrides` entry is not, because deciding whether it matched anything would mean
intersecting each entry's scope with the directory set. Simplicity wins; the rule page says so.

**Superseded 2026-07-29 —** a key whose every match is pruned by `exclude` is now reported as inert.
As shipped, this rule recorded a key as having done work the moment it matched, before the `exclude`
check, so `units: { '**/tests/fixtures/*': '.ts' }` alongside `exclude: ['**/tests']` left a
declaration that evaluates nothing and says nothing. The code comment defending that ordering bundled
the excluded case with the lost-the-tie-break case; the tie-break half is right and stands, the
excluded half is not — an excluded directory is one the rule was forbidden to look at, not one it
looked at and had nothing to say about. `2026-07-29-directory-naming-design.md` carries the reasoning
and moves both rules to the corrected ordering through their shared module.

## Implementation scope

1. **`packages/core/src/source-files.ts`** (new) — `collectSourceFiles(rt, cwd)`.
2. **`packages/core/src/rule.ts`** — `RuleContext` gains `sourceFiles?: string[]`.
3. **`packages/core/src/index.ts`** — export the collector and the new rule name.
4. **`packages/core/src/rules/architecture/unit-entry-file.ts`** (new) — a hand-written `Rule`,
   following `performance/preconnect` and `architecture/private-scope-import`.
5. **`packages/core/src/rules/index.ts`** — registration: the import, `allRules`, the re-export block.
6. **`packages/cli/src/index.ts`** and **`packages/vite/src/analyze.ts`** — collect and pass the fact.
   The Vite package's `providers/source/components.ts` gains the thin wrapper its siblings have.

## Testing

- Each identification kind works independently: `units` only, `pascalCaseUnits` only, both.
- Precedence: a directory matched by both takes `units`' extension.
- Longest-key wins when several `units` keys match; **lexicographically first wins among equal-length
  keys**.
- **A `units` key containing `**` reaches a nested unit** one level deeper than a two-level glob would
  — the case that motivated `exclude`.
- **A `**` between two segments does not match zero segments**, pinned on both keys where it matters:
  `src/lib/api/**/*` does not treat the domain level as a unit, and `src/**/functions/**/*` (the wrong
  shape) checks no function unit — so a regression in the compiler cannot silently empty a declaration.
- **A directory whose only children are directories is still checked**, since the set is built from
  every ancestor prefix rather than from the parents of files.
- **A reserved directory swept in by a broad `units` glob is exempted by `exclude`**, and `exclude`
  prunes the whole subtree (a `tests/fixtures/` under an excluded `tests/` is exempt too).
- `exclude` outranks both declarations, including a PascalCase directory under a matching root.
- The two `Fix` descriptions are selected by which declaration matched.
- PascalCase boundaries: `PageHeader` checked; `searchForm`, `parts`, `[itemId=integer]` not.
- Conforming → one pass, `route` = the entry file, no `location`.
- Missing → one violation, `location` = the first file under the directory, no `line`.
- A directory holding only subdirectories still resolves to a file under it.
- A case-mismatched entry file (`Card/card.svelte`) is a violation.
- An inert declaration yields one project-scoped finding per key.
- A key declared only in an `overrides` entry yields no inertness finding (pins the limitation).
- Every silent input: `sourceFiles` absent, both options empty, undeclared directories.
- Per-path options through `overrides` reach the rule (the per-rule-options parity check).
- **Missing entry-file violations point at a direct child when one exists**, and only fall back to the
  subtree when the directory holds nothing but subdirectories — the ordering, not just the existence.

### Validate the documented example against a real tree

Every error this spec's example configuration has contained was found by running it over a real
project's tree, never by reading it: a `units` glob that missed nested units and swept in `tests/`; an
`exclude` list that silenced a large share of the legitimate units; and a `**` in the wrong position
that checked no function unit at all. None is visible from the prose.

So the plan carries a step for it, and the step has three checks — because the obvious one is not
sufficient on its own:

1. **On a tree that already complies, violations must be 0.** Catches false positives.
2. **Count the directories actually checked.** Zero violations reads identically as "the tree
   complies" and "the globs matched nothing", and only the count separates them. This is the check
   that would have caught the `**/functions/**/*` mistake, where violations were 0 because no function
   unit was examined.
3. **Compare the count against the tree's real unit count.** A count that is plausible but low is the
   `exclude`-over-pruning failure — most of the PascalCase units examined, the rest silently pruned,
   and no violations to show for it.

A unit test proves the mechanism; only a real tree proves the example, and only the count proves the
example is doing anything.

### The tree to validate against

A real SvelteKit application is available in two states, which together cover both failure directions:

| State                | Expectation                                                        |
| -------------------- | ------------------------------------------------------------------ |
| Convention-compliant | **Zero** findings, with an examined count matching the population  |
| Pre-convention       | A **known non-zero** count of findings from the same configuration |

Its unit population is known for each of the four declared kinds — PascalCase component units,
function units and their nested helpers, store units, and api units and their nested helpers. That
population is what checks 2 and 3 above compare the examined count against; whoever runs the step
counts it on the tree in front of them.

On the pre-convention state, a **small, known number** of PascalCase directories hold no same-named
`.svelte`, and those are the findings this rule should produce.

**Other known defects in that state are _not_ this rule's** — occurrences of `types/types.ts` and
`types/index.ts`. Both are forbidden _filenames in a location_, a different claim: `types/` is not a
unit under any declaration here (it sits in `exclude`), so no entry file is expected of it and none is
missing. Expecting this rule to report them would send the validation step hunting a bug that is not
there. They belong to a forbidden-filename mechanism, which M2 and M3 do not cover either — the
charter's inventory has no row for it yet.

## Documentation

Rule pages in en and ja, the configurable-rules list in `configuration.mdx` (en and ja), and a minor
changeset. Then **regenerate the rule index pages** with
`pnpm --filter svelte-vitals run gen:rules-index && pnpm format` and commit them — AGENTS.md requires
it and `packages/cli/test/rules-index.test.mjs` fails when they are stale. This step was missed on the
previous rule and CI caught it; it belongs in the plan's global constraints.

The rule pages state three things explicitly: that the rule is inert until configured; that a root
outside `src/` is neither supported nor needed; and that a key declared only inside an `overrides`
entry is not checked for inertness.

## Out of scope

- **"Every file in a unit directory must match its name."** This rule asks only whether the entry
  file exists, so a shared `types.ts` beside `fetchItem.ts` is fine and needs no exclusion pattern.
  Restricting _what else_ may sit in a unit directory is a different claim and a different rule.
- **The converse casing rule** — that a directory unable to hold a same-named entry must be camelCase
  — is the naming-convention mechanism (M2), not this one. This rule's `Fix` text points at it.
- **Reserved-directory vocabulary and permitted locations** (M3, M4). M4 still waits on the
  structured-list option kind.
- **Export-name matching** (`getX.ts` must export `getX`). Needs a parser path for arbitrary `.ts`,
  which no collector provides today.
- **Multiple acceptable extensions per declaration.** One extension per entry; a mixed `.ts`/`.js`
  project would need the structured-list option kind, and no demand has been observed.
