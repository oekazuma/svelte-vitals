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

Two options, both `kind: 'string-map'`, both defaulting to `{}`. A project that sets neither gets no
output at all.

```js
// svelte-vitals.config.js
export default {
  rules: {
    'architecture/unit-entry-file': {
      options: {
        // Identified by PATH: directory glob → the entry file's extension
        units: {
          'src/**/functions/*': '.ts',
          'src/**/stores/*': '.svelte.ts',
          'src/lib/api/*/*': '.ts'
        },
        // Identified by CASING: root glob → the entry file's extension.
        // Every PascalCase directory under a matching root is a unit.
        pascalCaseUnits: { 'src/**': '.svelte' }
      }
    }
  }
};
```

### Why two options rather than one

The two kinds of unit are identified by genuinely different means, and neither subsumes the other:

- **camelCase directories are ambiguous by design.** The convention allows a camelCase directory to
  be a unit (`{name}/{name}.ts`) _or_ a grouping (no entry file at all). Casing cannot decide which,
  so these units must be identified by position.
- **PascalCase directories are unambiguous, but positionally unbounded.** They nest arbitrarily
  inside `parts/` and grouping directories, so position cannot identify them, while casing can.

Collapsing both into one map would mean inferring the identification style from the key's shape —
implicit, and wrong the first time a key is ambiguous. Two options keep each declaration's meaning
on its face.

Both are `string-map`, so no new option kind is needed: this ships without waiting on the second
rule-options iteration. Their merge semantics are additive with per-key override, so an `overrides`
entry can add or re-point a declaration per path.

### Precedence

1. If any `units` key glob matches the directory, its extension is expected. **When several match,
   the longest key wins** — the most specific declaration.
2. Otherwise, if the directory's basename begins `A`–`Z` and any `pascalCaseUnits` key glob matches,
   that extension is expected.
3. **`units` beats `pascalCaseUnits`**: an explicit path declaration outranks a naming convention.
4. Matching neither leaves the directory unchecked.

`PascalCase` means **the basename's first character is `A`–`Z`**. That is the whole definition:
`SeoContents` qualifies; `fairSearch`, `parts` and `[hallId=integer]` do not.

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
2. Derive the directory set from the file paths.
3. For each directory, resolve options against the target `{ route: dir, file: dir }` — the same
   convention `componentRule` uses, so a `files:`-scoped override reaches it. Compiled globs are
   memoised on the resolved option values, since a project has a handful of distinct declarations
   and thousands of directories.
4. Apply the precedence above to get the expected extension, or skip.
5. The directory conforms when `${dir}/${basename(dir)}${ext}` is in the file set.

## Precision — what the rule stays silent about

| Input                                             | Behaviour                     | Why                                                     |
| ------------------------------------------------- | ----------------------------- | ------------------------------------------------------- |
| `sourceFiles` absent                              | No results                    | Dev live layer and `--route` mode, as with `components` |
| Both options empty                                | No results                    | L3 inertness                                            |
| A directory matched by neither option             | Skipped                       | Not declared                                            |
| A directory whose basename does not begin `A`–`Z` | Skipped for `pascalCaseUnits` | `parts`, `fairSearch`, `[hallId=integer]`               |

### The one false positive the convention itself invites

A convention may mirror source paths into a non-source tree — for instance an asset directory that
reproduces `src/` paths verbatim, PascalCase segments included. Those PascalCase directories legitimately
contain no `.svelte`.

This is structurally prevented: **the fact only collects `src/`**, so a mirrored asset tree never
enters the directory set. The root glob (`src/**`) is a second guard. The rule page states that a
root outside `src/` is neither supported nor needed.

### Case-insensitive filesystems

On a case-insensitive filesystem, `Card/card.svelte` exists on disk under that exact name, and the
glob returns it as written, so the lookup for `Card.svelte` misses and the directory is reported.
**That verdict is correct** — the convention requires the directory and file names to match — and it
is pinned by a test so the behaviour is not mistaken for a bug later.

## Finding shapes

Three kinds.

### 1. Violation — the entry file is missing

`route` and `location` are **the alphabetically first existing file anywhere under the directory**.
Not the directory itself: `filterToChangedFiles`
(`packages/cli/src/changed-files.ts`) keeps only results whose `location` is in the changed-file set,
and a directory never appears in git's changed-file list — so a directory location would make the
finding invisible in exactly the run meant to catch it. This violation appears when someone creates
`Card/` containing only `Badge.svelte`, and that file _is_ in the changed set.

The first file _anywhere_ under the directory, rather than directly inside it, because a directory
may hold only subdirectories. A directory is in the set only because some file sits under it, so
this always exists.

No `line`. The message names both the directory and the expected file.

`Fix.description`, no `snippet`: "Add an entry file named after this directory, or rename the
directory to camelCase if it is a grouping." Two remedies are valid, so the text gives the direction
rather than naming one as canonical — the same latitude the charter's actionability gate grants
`architecture/component-size`.

### 2. Pass — the unit conforms

`route` is **the expected entry file**, which exists by definition here. No `location`, matching
`componentRule`'s passing results so `filterToChangedFiles` can drop the seed.

This choice is what keeps scoring honest. `computeScore` seeds every distinct `route` at 100 and
averages, so a pass keyed on the _directory_ would add one 100 per conforming unit and dilute every
real finding in the project. Keyed on the entry file, a component unit's pass lands on a `.svelte`
path that is **already** a score key, so it adds nothing. A function or store unit's `.ts` entry does
add one key; those are far fewer, and a malformed unit becoming its own scoring subject is defensible.

### 3. Inert declaration — a key matched no directory

One finding per option key that matched no directory at all, as a **project-scoped** result: no
`route`, no `location`, `presence: 'none'`. A declaration that checks nothing is a configuration
problem, not a file's problem.

This is the failure mode that motivated moving these checks here at all, so the rule reports it
rather than leaving the user to wonder whether their globs took effect.

**Limitation, deliberate:** only the globally resolved options
(`config.rules['architecture/unit-entry-file'].options`) are checked for inertness. A key declared
solely inside an `overrides` entry is not, because deciding whether it matched anything would mean
intersecting each entry's scope with the directory set. Simplicity wins; the rule page says so.

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
- Longest-key wins when several `units` keys match.
- PascalCase boundaries: `SeoContents` checked; `fairSearch`, `parts`, `[hallId=integer]` not.
- Conforming → one pass, `route` = the entry file, no `location`.
- Missing → one violation, `location` = the first file under the directory, no `line`.
- A directory holding only subdirectories still resolves to a file under it.
- A case-mismatched entry file (`Card/card.svelte`) is a violation.
- An inert declaration yields one project-scoped finding per key.
- A key declared only in an `overrides` entry yields no inertness finding (pins the limitation).
- Every silent input: `sourceFiles` absent, both options empty, undeclared directories.
- Per-path options through `overrides` reach the rule (the per-rule-options parity check).

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
  file exists, so a shared `types.ts` beside `fetchHall.ts` is fine and needs no exclusion pattern.
  Restricting _what else_ may sit in a unit directory is a different claim and a different rule.
- **The converse casing rule** — that a directory unable to hold a same-named entry must be camelCase
  — is the naming-convention mechanism (M2), not this one. This rule's `Fix` text points at it.
- **Reserved-directory vocabulary and permitted locations** (M3, M4). M4 still waits on the
  structured-list option kind.
- **Export-name matching** (`getX.ts` must export `getX`). Needs a parser path for arbitrary `.ts`,
  which no collector provides today.
- **Multiple acceptable extensions per declaration.** One extension per entry; a mixed `.ts`/`.js`
  project would need the structured-list option kind, and no demand has been observed.
