# `architecture/private-scope-import` — Design

Date: 2026-07-28
Status: Approved

## Problem

`2026-07-28-architecture-charter-design.md` admits this rule as **M5**, the first L3 rule and the
first step of its sequencing. It is the mechanism behind the colocation principle that a
project-wide structure document expresses as a promotion ladder:

> Code lives as close as possible to where it is used. Sharing is expressed by moving it up a
> directory. Move it up only when a second import appears, and only as far as the two importers'
> common ancestor. When a unit inside `parts/` is used by something other than its parent, take it
> out of `parts/`.

Stated as a check, that principle is: **a unit inside a private scope must not be imported from
outside that scope.** Nothing enforces this today. A file-local tool cannot enforce it at all — the
violation exists only in the relation between two files, and which directories are private is a
project's own declaration.

Layer **L3**: the convention is declared, never inferred. The rule is inert until the project
declares its private scopes.

## Rule identity

| Field    | Value                                                                                      |
| -------- | ------------------------------------------------------------------------------------------ |
| id       | `architecture/private-scope-import`                                                        |
| category | `architecture`                                                                             |
| severity | `info` — the severity of the findings it emits once declared, not a statement that it runs |
| scope    | component                                                                                  |
| layer    | L3 — inert until declared                                                                  |

## Configuration

One option, `scopes`: a list of globs matching **marker directories**. The boundary of a scope is
the marker directory's **parent**.

```js
// svelte-vitals.config.js
export default {
  rules: {
    'architecture/private-scope-import': {
      options: { scopes: ['**/parts', 'src/routes/**/components'] }
    }
  }
};
```

`kind: 'string-list'`, default `[]`. An empty list makes the rule emit nothing at all.

### Why the glob matches the marker, not the files

Matching **directory names** alone (`['parts', 'components']`) was considered and rejected: the name
`components` occurs both privately (`src/routes/…/components`) and app-wide (`src/lib/components`).
A name-based rule would take `src/lib/` as the boundary of `src/lib/components` and flag every
route that imports a shared component — the single most common import in a SvelteKit app.

Matching the marker directory keeps the boundary independent of how the user writes the glob. A
scheme that matched _files_ (`'**/parts/**'`) would put the boundary wherever `/**` happens to sit,
so a slightly different pattern would silently move it.

Worked through against a real convention document:

| Directory                               | Matched by                 | Boundary                      | Effect                            |
| --------------------------------------- | -------------------------- | ----------------------------- | --------------------------------- |
| `Foo/parts`                             | `**/parts`                 | `Foo/`                        | importable only from under `Foo/` |
| `src/routes/search/hallList/components` | `src/routes/**/components` | `src/routes/search/hallList/` | importable only from that route   |
| `src/lib/components`                    | neither                    | —                             | unconstrained, as intended        |

### Glob semantics

Globs compile through the existing route-glob compiler (`routeGlobToRegExp`,
`packages/core/src/config-apply.ts`): `*` within a segment, `**` across segments, everything else
literal including `(`, `)`, `[`, `]`.

One consequence is worth stating, because it changes how a `scopes` value must be written: a
doubled star in a middle position **does not match zero segments**. `src/routes/**/components`
compiles to `^src/routes/.*/components$`, which does not match `src/routes/components`. A project
with a marker directly under `src/routes` must list both patterns. This is existing compiler
behaviour, not something this rule introduces.

## Verdict

For each component, for each of its imports:

1. Resolve the specifier to a repo-relative path with `resolveRepoLocalPath`. Undefined (a bare
   package, an unknown alias, `..` escaping the root) → **silent**.
2. Walk the resolved path's ancestors and take the **deepest** directory matching a `scopes` glob.
   No match → the target is not in a private scope; nothing to check.
3. The boundary is that marker's parent directory. If the **importing** file is not inside the
   boundary subtree, the import is a violation.

The deepest match is what makes nesting behave. For `A/parts/B/parts/C/C.svelte` the boundary is
`A/parts/B/`, so `C` stays private to `B` — matching "a unit inside `parts/` is used only by its
parent" at every level rather than only the outermost one.

## Precision — what the rule stays silent about

| Input                                                                    | Behaviour     | Why                                                                                                                                                                             |
| ------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bare packages, `$app/*`, any unknown alias                               | Silent        | Cannot be resolved to a repo-relative path                                                                                                                                      |
| Custom `svelte.config.js` aliases (`$app-name/lib/…`)                    | Silent        | `resolveRepoLocalPath` handles `$lib/` and relative specifiers only — see Follow-ups                                                                                            |
| A relative specifier whose `..` escapes the repo root                    | Silent        | Already `undefined` from the resolver                                                                                                                                           |
| Imports written in a `.svelte.ts` / `.svelte.js` module                  | Silent        | Those files are collected as `ComponentFacts`, but `parseModuleFacts` populates only the orphan-effect family — `imports` / `importSpans` stay empty by design — see Follow-ups |
| Imports written in a Kit module (`+page.ts`, `+server.ts`, `hooks.*.ts`) | Silent        | Outside the component glob entirely, and `KitModuleFacts` carries no general import list — see Follow-ups                                                                       |
| `scopes` unset or empty                                                  | Silent        | L3 inertness                                                                                                                                                                    |
| A component with no import resolving into a marked scope                 | Emits nothing | `applies` is false for that file                                                                                                                                                |

Every one of these is a false **negative**. None can produce a false positive, which is what the
charter's precision gate requires.

## Finding shape

Reported at the **import site** — the importing file and the import's line.

The corrective edit touches both files: the unit moves, and each import path updates. The import
site is chosen because of the changed-files workflow: `--diff` filters results to the files that
changed (`packages/cli/src/changed-files.ts`), and the person who introduced the violation edited
the importer, not the target. Reporting on the target would filter the finding out of exactly the
run meant to catch it. The import site also carries a line, which `importSpans` provides and the
target does not.

Several importers produce several findings. That is not duplication: each is an import path that
must change. It matches the grain of `performance/heavy-import`, which also reports per import site.

| Aspect    | Value                                                                   |
| --------- | ----------------------------------------------------------------------- |
| `applies` | at least one import resolves into a marked scope                        |
| PASS      | every such import is inside its boundary                                |
| Penalized | `location` and `route` = the importing file, `line` = the import's line |
| Message   | names both the imported unit and the boundary it crossed                |
| `fix`     | `description` only, no `snippet`                                        |

`Fix.description`: "Move this unit out of its private scope, to the directory shared by all of its
importers, and update this import."

No snippet: moving a file has no canonical code fragment. `Fix.snippet` is optional
(`packages/core/src/types.ts`), and the charter's actionability gate requires a snippet only where a
canonical edit exists.

## Implementation scope

Four changes, no new facts and no new option kinds.

1. **`packages/core/src/kit-module-parse.ts`** — export `resolveRepoLocalPath`. The rule needs
   resolution that is not restricted to runes modules, which `resolveRunesModuleSpecifier` is.
   Resolution stays wholly inside this one function, so alias support later is a single-site change.
2. **`packages/core/src/config-apply.ts`** — export `routeGlobToRegExp` (currently module-private),
   so scope globs compile through the same code as `route`/`files` overrides rather than a second
   implementation that could drift.
3. **`packages/core/src/rules/architecture/private-scope-import.ts`** — a hand-written `Rule`. The
   `componentRule` factory judges one file at a time and cannot express a verdict about a relation
   between two, so this follows the shape of `performance/preconnect`. Options resolve per component
   (an `overrides` entry may declare different scopes for different paths), so the compiled globs are
   memoised on the resolved list rather than compiled once per `check` — one `check` can legitimately
   need more than one set, but not one set per file.
4. **Registration in four places** (AGENTS.md): the import, the `allRules` entry, and the re-export
   block in `packages/core/src/rules/index.ts`, plus the duplicate re-export list in
   `packages/core/src/index.ts`.

## Testing

- The three cases from a real convention document: `parts/`, a route-scoped `components/`, and
  `src/lib/components` remaining unconstrained.
- Nested markers resolve to the **deepest** boundary.
- Inside the boundary → PASS; outside → penalized, with the line from `importSpans`.
- Every silent input in the precision table, each proving zero output.
- `scopes` unset → the rule produces no results at all.
- `**` not matching zero segments in a middle position, so the documented workaround stays true.
- Options resolve per path through `overrides`, the parity the per-rule-options work requires.

## Documentation

Rule pages in en and ja, and the configurable-rules list in `configuration.mdx` (en and ja). The
rule page states in the present tense that alias-resolved imports are not yet checked — a current
gap being closed, not a standing limitation.

A minor changeset ships **with the implementation**, not with this document: the rule is a
user-facing addition, while a design doc under `docs/superpowers/` is internal and needs none.

## Follow-ups (before 1.0)

- **Alias resolution.** Many SvelteKit projects import through a custom `svelte.config.js` alias, and
  those imports are invisible to this rule today. Reading `kit.alias` into a `Project` fact has a
  precedent in `findKitPathsBaseInSvelteConfig`, and `resolveRepoLocalPath` is the single place that
  would consume it. **To be closed before 1.0** — the charter's out-of-scope entry for module
  resolution now carries that deadline.
- **Imports written in a `.svelte.ts` / `.svelte.js` module.** These files already reach every
  component rule, so the gap is that `parseModuleFacts` leaves `imports` / `importSpans` empty.
  Populating them is not a free change: `performance/heavy-import`'s `applies` is
  `(c) => (c.importSpans ?? c.imports).length > 0`, so it would begin firing on runes modules, which
  the current emptiness deliberately prevents. Whoever closes this must decide what `heavy-import`
  should do there rather than change it by accident.
- **Imports written in a Kit module** (`+page.ts`, `+server.ts`, `hooks.*.ts`), once `KitModuleFacts`
  carries a general import list. Separate from the item above: those files are outside the component
  glob altogether.

## Out of scope

- Counting importers to decide _where_ a unit should move to. The rule reports that a boundary was
  crossed; choosing the new home is the author's.
- Per-marker exceptions (`{ marker, roots }`). Needs the structured-list option kind from the second
  rule-options iteration; `scopes` globs cover the cases seen so far.
- Extension and index resolution for a full import graph — the prerequisite the charter records for
  circular imports, not needed here because both sides of the comparison are already file paths.
