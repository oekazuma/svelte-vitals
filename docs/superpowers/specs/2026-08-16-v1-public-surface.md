# Design: the 1.0 public surface

Phase A-1 of `2026-08-16-v1-roadmap.md`. Decides, surface by surface, what 1.0's semver promise
covers. **Frozen** may only change in a 2.0; **internal** carries no promise; **removed** goes away
while removal is still free.

The classification rests on one measured fact: of `@svelte-vitals/core`'s ~50 export statements,
**zero** are referenced by the docs site or by any package README — the package's own README says
"most users don't depend on this directly". Core's exports are cli↔vite plumbing that had to be
public only because they cross a package boundary.

## The shape: a dedicated `internal` subpath

`@svelte-vitals/core` gains a second entry point:

```jsonc
// packages/core/package.json
"exports": {
  ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
  "./internal": { "types": "./dist/internal.d.ts", "import": "./dist/internal.js" }
}
```

- `.` — the frozen surface below. Small, documented, semver-stable at 1.0.
- `./internal` — everything cli and vite share. Its module doc states verbatim that it carries
  **no semver guarantee and may change in any release, including patch**. `svelte-vitals` and
  `@svelte-vitals/vite` import their plumbing from here; both are versioned in lockstep with core
  through workspace ranges, so a breaking internal change is a same-PR change.

`@svelte-vitals/vite` already ships a two-entry ESM build (`.` + `./hooks`) through the same
tsup + publint/attw pipeline, so the mechanism is proven in-repo. `scripts/floor-smoke.mjs`
resolves `dist/index.js` by path, which the split leaves intact.

### The `.` entry is type-closed, and that is what makes it small

A frozen export may not reference a type that is internal — otherwise a patch-legal change to the
internal type silently breaks the frozen contract. Today's index fails this badly: `runRules`
returns `FailedRule[]`; `RuleContext` embeds `ResolvedHead`, `ResolvedImages`, `ResolvedHeadings`,
`ResolvedA11y`, `ComponentFacts`, `KitModuleFacts`; `Rule.options` is a `RuleOptionsSpec`;
`formatConsoleReport` takes `ConsoleReportOptions`. Freezing any of those drags the entire engine
into the promise — including `ResolvedA11y`, which roadmap Phase C exists to reshape.

So `.` is scoped to the two jobs an outside caller actually has, and closed under both:

1. **Authoring a config** — `defineConfig` and the `Config` type graph.
2. **Reading a report** — the `JsonReport` type graph.

Everything engine-side (`Rule`, `RuleContext`, `allRules`, `runRules`, `explainRule`, `Runtime`,
the non-JSON `format*Report` functions, scoring functions) is **internal**. None of it is taught by
any doc, and each can be promoted into `.` in a 1.x minor once a real consumer asks — promotion is
additive, so nothing is lost by starting closed.

## Frozen at 1.0

### `svelte-vitals` (CLI)

- **Binary behaviour**: every flag currently in `gunshi/*.ts` — root/analyze (`--meta-components`,
  `--treat-dynamic-as`, `--route`, `--diff`, `--staged`, `--baseline`, `--update-suppressions`,
  `--no-suppressions`, `--by-route`, `--reporter`, `--out-file`, `--fail-on`, `--min-health`,
  `--rules`, `--ignore`, `--category`, `--weights`, `--score`, `--no-color`, `--no-animation`,
  `--verbose`, `--help`, `--version`), and the `install` / `ci` / `explain` / `docs` sub-commands
  with their flags. Adding flags stays minor; removing or repurposing one is 2.0. The list is
  illustrative of scope, not the enforcement artifact — see Sequencing.
- **Reporter names** (`--reporter` values) and the auto-detection contract: which environment
  signals pick which default reporter is documented behaviour, so changing a signal's meaning is
  2.0. Adding a reporter name is minor.
- **Exit codes**: `0` clean · `1` failing finding or threshold · `2` execution error.
- **`defineConfig`** re-exported from `svelte-vitals` (the package users install). This is the only
  programmatic export the docs teach.
- **Scaffolding outputs**: the file paths `install` and `ci install` write (agent skill file,
  config file, workflow file) and the fact that the scaffolded workflow pins the Action by a
  generated version. Their _contents_ are not frozen — they are generated guidance, and both
  commands are re-runnable.
- **`docs show <topic>`**: the topic names are frozen (they appear in agent instructions); the
  prose is not.

The rest of `packages/cli/src/index.ts`'s exports (`run`, `analyzeProject`, `applyScope`,
`routeMatcher`, `loadConfigFile`, `findUnknownRuleIds`, …) are **internal**: no doc teaches them,
and the CLI is documented as a binary. They keep working; they carry no promise. Recorded here so
a future "programmatic API" is a deliberate 1.x addition, not an accident.

### `@svelte-vitals/vite`

- `svelteVitals(options)` and the `SvelteVitalsOptions` fields: `cwd`, `treatDynamicAs`,
  `metaComponents`, `rules`, `overrides`, `failOn`, `weights`, `report`, `outFile`, `prerenderDir`,
  `ui`.
- `@svelte-vitals/vite/hooks`'s `svelteVitalsHandle(options)` and `SvelteVitalsHookOptions`
  (`metaComponents`, `rules`).
- The dev-dashboard route (`/__svelte-vitals/`) as a URL, not its HTML.

### Package names and engines

- The three published names (`svelte-vitals`, `@svelte-vitals/core`, `@svelte-vitals/vite`) and
  their subpaths (`./internal`, `./hooks`).
- **`engines.node`**: raising the floor to a Node line that is still in Long Term Support at the
  time of the bump is a **minor**; dropping to an unsupported-by-us line or raising past current
  LTS is 2.0. Stated because a Node floor is the most commonly disputed semver surface for a CLI
  and AGENTS.md already treats the published floor as a promise to end users.

### Configuration

The config file schema in full: `treatDynamicAs`, `metaComponents`, `rules` (with the
`'off' | Severity | { severity, options }` setting shapes), `failOn`, `weights`, `overrides`
(`route` / `files` globs + `rules` keyed by rule id or category), and the documented precedence
(CLI flag > config file > default, `--rules`/`--ignore` as selection exceptions). Config file
names, discovery order, and the `.ts`/`.mjs` support matrix are frozen too.

**Adding a top-level config key, or a new option to an existing rule, is a minor** — the schema is
frozen against removal and reinterpretation, not against growth. Phase C's component-mapping key
is exactly this case.

### Rule identity and persisted data

- **Rule ids** (`category/slug`) — they appear in configs, suppression files, CI annotations, and
  published docs URLs. Renaming a rule after 1.0 needs a deprecation path, not a rename.
- **`findingKey` = `id::route::location`** — the suppressions-file contract. `line` stays excluded.
- **Suppressions file**: name `svelte-vitals-suppressions.json`, `{ version: 1, suppressions: [{ id, route?, location? }] }`.
  The `version` field is the migration hatch; 1.0 promises to keep reading `1`.
- **Inline directive**: `// svelte-vitals-disable-next-line [id[, id…]]` and its
  `<!-- … -->` form, whole-line, applying to the next line.
- **Docs URL shape**: `<docs-origin>/rules/<id>`. The origin itself is not frozen (a domain move
  must stay possible); the path shape is, because `docsUrl` is persisted in JSON/SARIF output.

### Report shapes

- **JSON reporter** (`JsonReport`): frozen field-for-field as documented in the reporters guide —
  `version, score, weights, categories, summary, rules{findings,passed}, routes[], siteIssues[],
inventories, examined?`, closed over exactly `Summary`, `RuleEvidence`, `JsonIssue`, `Result`,
  `Detection`, `Presence`, `Value`, `Fix`, `Category`, `Severity`, `Config`, and `ScoreModel`.
  Every field listed above, and its meaning, is frozen; new fields may be added in a minor **only
  as optional**, and consumers must ignore fields they do not know — a parser that rejects unknown
  keys is relying on something 1.0 does not promise.
  `ScoreModel` is named rather than "the scoring types": the neighbouring `ScoreOptions` carries
  `rules?: Rule[]`, so freezing that group would drag `Rule` → `RuleContext` → `ResolvedA11y` back
  into the promise. Additive fields stay minor; removing or retyping one is 2.0.
- **SARIF** stays valid SARIF 2.1.0; **GitHub** stays valid workflow commands. Both are frozen by
  reference to their external specs, not to our own layout.
- **agent / markdown / html** reporters are **human/agent-readable output, not schemas**: their
  prose, ordering, and caps may change in any release. Stated explicitly so nobody parses them.

### `@svelte-vitals/core`'s `.` entry (after the split)

- `defineConfig` and the config types it closes over: `Config`, `RuleSetting`, `RuleSettingObject`,
  `RuleOverride`, `RuleOptions`, `Severity`, `Category`, `CATEGORIES`, `TreatDynamicAs`.
- `JsonReport` and the types it closes over (listed above).

Nothing else — and specifically **not** `Project`, `KitAlias`, or `Scope`: no frozen type reaches
them, `Project` grows a field per project-scoped rule, and `Scope` belongs to `Rule`. They are
internal.

## Internal (moves to `./internal`, no promise)

Everything else in today's index, without exception. Named here only where a reader would expect a
different answer:

- The engine: `Rule`, `RuleContext`, `allRules`, `runRules`, `FailedRule`, `explainRule`,
  `RuleInfo`, `RuleOptionInfo`, `isPenalized`, `docsUrlFor`, `Runtime`.
- Report machinery other than the JSON types: `buildJsonReport`, `formatJsonReport`, every other
  `format*Report`, `ConsoleReportOptions`, `terminalSafe`, the palette, the app-shell renderers
  (`buildHtmlDocument`, `scoreBand`, `BAND_COLOR`, `APP_SCRIPT`, `APP_STYLE` — vite's dashboard and
  its tests consume these), scoring functions, `summarize`, `classify`, `Classification`,
  `effectiveSeverity`.
- Fact collection and AST helpers: `CHILD_NODE_KEYS`, `lineOf`, `findAttr`, the `attr*` family,
  `valueFromNodes`, `textFromNodes`, `parseComponentFacts`, `collectComponentFacts`,
  `emptyComponentFacts`, `collectSourceFiles`, `ComponentFacts`, `SuppressionDirective`, the
  `*Fact` types, and the **whole** kit-module family — `parseKitModuleFacts`,
  `resolveRunesModuleSpecifier`, and `resolveRepoLocalPath` (which cli's source resolver imports
  and an earlier draft of this spec left unclassified).
- Config plumbing: `findMinifyDisabled`, the svelte-config family, `project-paths` constants,
  `selectRules`, `applyRuleSeverities`, `applyOverrides`, `compileOverrides`, `overrideMatches`,
  `CompiledOverride`, `withFailedRulesOff`, `isMentionedAnywhere`, `resolveRuleOptions`,
  `validateRuleSetting`, `validateRuleOptions`, `settingOptions`, `intOption`, `listOption`,
  `mapOption`.
- The a11y composition helpers (`foldOccurrences`, `decodeFragmentId`, `splitTokens`,
  `isTopFragment`, `LANDMARK_ROLES`, `IDREF_ATTRS`, `BranchStep`, `A11yOccurrenceInfo`,
  `ResolvedA11y`), the provider boundary types (`HeadTag`, `ResolvedHead`, `HeadProvider`,
  `ImageInfo`, `ResolvedImages`, `HeadingInfo`, `ResolvedHeadings`), and the rule factories
  `headTagRule`, `imageRule`, `linkRule`.
- The ~90 individual rule functions (`seoTitlePresence` … `a11yNoMissingIdRef`) — ~30 core tests
  and 3 cli tests import them by name.

`ResolvedA11y` and friends being internal is the point: the a11y roadmap's remaining increments
reshape them.

`attrText`/`attrValue` vs `attrTextOf`/`attrValueOf` (same purpose, two call shapes) stay both —
internal after the split, so the duplication costs nothing publicly and consolidating them is a
free internal change later.

## Removed

One thing, and it is not a symbol:

- **The hand-maintained rule re-export list in `index.ts`** (`index.ts` lines ~71-162). `internal.ts` uses
  `export * from './rules/index.js'` instead. **This retires one of the four registration places
  AGENTS.md mandates** — the one its own "TypeScript won't catch a missed spot" warning is about —
  while every rule function stays importable, so no test changes meaning.

Nothing else is deleted. An earlier draft listed ~20 symbols as "imported by nothing in-repo";
that was measured against `src/` only and is false — `packages/core/test` (≈50 files),
`packages/cli/test` (3 files importing rule functions), and `packages/vite/test` (4 files importing
`APP_SCRIPT` / `buildHtmlDocument`) all import them. Reclassifying instead of deleting costs
nothing: an internal export carries no promise.

## Implementation notes for the split

**Retarget per symbol, not per file.** `./internal` does not re-export `.`'s names, so a file that
uses both keeps two import statements — and that is the desired end state: production code
consuming `Config`, `defineConfig`, or `JsonReport` should keep importing them from the root, where
it demonstrates the frozen surface. cli's `config-file.ts`, `suppressions.ts`, and vite's
`ui/middleware.ts` import a mix today (`Config` alongside `isPenalized` / `renderAppShell`); each
such line splits rather than moves wholesale.

Three call sites need care:

1. **Core's own tests** import from `../src/index.js` in ~50 files. Retarget the internal names to
   `../src/internal.js` (or the owning module) — do not widen `.` to keep a test import compiling.
2. **cli and vite tests** import from `@svelte-vitals/core` root. Same per-symbol split. A test
   import is never a reason to freeze a symbol.
3. **`index.ts` must not import from `internal.ts`, and vice versa.** Both re-export from the same
   underlying modules; neither re-exports the other, so there is no cycle and no risk of `.`
   accidentally re-exporting internal symbols through a barrel.

`check:publish` (publint + attw `--profile esm-only`) must pass for both entry points.

## Enforcement

`public-surface.json` holds **two** sets, because exports and declarations are not the same
question:

- `exports` — the names `.` re-exports, split `values` / `types`. This is the promise.
- `closure` — every identifier allowed to be **declared** in `dist/index.d.ts`. A superset of
  `exports`: `JsonIssue` is a non-exported type alias in `reporter/json.ts` that the bundler
  inlines, so it is legal in the closure and must never become an export.

A test in `packages/core/test/` asserts three things:

1. `src/index.ts`'s export list equals `exports` (and the built `dist/index.js`'s runtime exports
   equal `exports.values`, so a build that drops or adds a name fails too). A new name fails with
   "add it to the frozen surface or export it from ./internal instead".
2. `dist/index.d.ts` contains **zero** `import` statements — today's
   `import { AST } from 'svelte/compiler'` must not survive into `.`.
3. Every identifier `dist/index.d.ts` declares is in `closure`.

Assertion 3 is what catches a type drag-in, and it needs the separate set to work: `rollup-plugin-dts`
**inlines** every reachable in-package declaration, so "references only what it declares" is
self-satisfying by construction — pulling in `RuleContext` would inline `ResolvedA11y` et al. as new
declarations, which `closure` rejects while `exports` alone would not have noticed. Closure is the
invariant that makes the frozen list meaningful, and it is not preserved by review alone.

## Corrections this audit surfaced (fix before the freeze)

- `docs/.../reporters.md` (en + ja) shows `"docsUrl": "https://svelte-vitals.dev/rules/…"` in the
  JSON example, but `docsUrlFor` emits `https://oekazuma.github.io/svelte-vitals/rules/…`. The
  example teaches a URL the tool never produces.
- `SvelteVitalsOptions.overrides` is absent from the plugin-mode options table and the vite README,
  the only plugin option with no doc coverage.

## Sequencing

The `.`/`./internal` split and the re-export removal land **now** (0.x, free). The freeze — the
enforcement artifact plus the "frozen" wording in the READMEs — lands last, in roadmap Phase E, so
the a11y increments in Phase C can still reshape internal signatures on the way.

Consequence: **the enumerations in this document are the decision, not the artifact.** Phases C-D
add flags, config keys, and rule ids. At Phase E, `public-surface.json` and the flag list are
re-derived from the code as it stands, and this document is what says which _kind_ of thing belongs
in them.
