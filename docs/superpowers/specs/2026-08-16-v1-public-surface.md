# Design: the 1.0 public surface

Phase A-1 of `2026-08-16-v1-roadmap.md`. Decides, surface by surface, what 1.0's semver promise
covers. Everything listed **frozen** may only change in a 2.0; everything listed **internal**
carries no promise; everything listed **remove before 1.0** goes away while removal is still free.

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

This keeps internal refactors free after 1.0 (composition memoization, the seven-walk
consolidation, and the a11y Phase 2/3 work all touch these signatures) without a major bump.

## Frozen at 1.0

### `svelte-vitals` (CLI)

- **Binary behaviour**: every flag currently in `gunshi/*.ts` — root/analyze (`--meta-components`,
  `--treat-dynamic-as`, `--route`, `--diff`, `--staged`, `--baseline`, `--update-suppressions`,
  `--no-suppressions`, `--by-route`, `--reporter`, `--out-file`, `--fail-on`, `--min-health`,
  `--rules`, `--ignore`, `--category`, `--weights`, `--score`, `--no-color`, `--no-animation`,
  `--verbose`, `--help`, `--version`), and the `install` / `ci` / `explain` / `docs` sub-commands
  with their flags. Adding flags stays minor; removing or repurposing one is 2.0.
- **Exit codes**: `0` clean · `1` failing finding or threshold · `2` execution error.
- **`defineConfig`** re-exported from `svelte-vitals` (the package users install). This is the only
  programmatic export the docs teach.

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

### Configuration

The config file schema in full: `treatDynamicAs`, `metaComponents`, `rules` (with the
`'off' | Severity | { severity, options }` setting shapes), `failOn`, `weights`, `overrides`
(`route` / `files` globs + `rules` keyed by rule id or category), and the documented precedence
(CLI flag > config file > default, `--rules`/`--ignore` as selection exceptions). Config file
discovery order and the `.ts`/`.mjs` support matrix are frozen too.

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
inventories, examined?`. Additive fields stay minor; removing or retyping one is 2.0.
- **SARIF** stays valid SARIF 2.1.0; **GitHub** stays valid workflow commands. Both are frozen by
  reference to their external specs, not to our own layout.
- **agent / markdown / html** reporters are **human/agent-readable output, not schemas**: their
  prose, ordering, and caps may change in any release. Stated explicitly so nobody parses them.

### `@svelte-vitals/core`'s `.` entry (after the split)

Only what a third-party integrator legitimately needs to read a report or drive the engine:

- Contract types: `Config`, `RuleSetting`, `RuleSettingObject`, `RuleOverride`, `RuleOptions`,
  `Severity`, `Category`, `CATEGORIES`, `TreatDynamicAs`, `Result`, `Detection`, `Presence`,
  `Value`, `Scope`, `Fix`, `Project`.
- `defineConfig`, `defaultConfig`, `defaultProject`.
- `Rule`, `RuleContext`, `allRules`, `explainRule`, `RuleInfo`, `RuleOptionInfo`, `runRules`,
  `isPenalized`, `docsUrlFor`.
- Report building: `buildJsonReport`, `formatJsonReport`, `JsonReport`, `RuleEvidence`, and the
  other `format*Report` functions.
- Scoring: `computeScore`, `scoresByCategory`, `computeHealth` and their result types.
- `Runtime` (the I/O injection interface — the documented way to run core in a non-Node host).

## Internal (moves to `./internal`, no promise)

Everything else in today's index: AST helpers (`CHILD_NODE_KEYS`, `lineOf`, `findAttr`,
`attrText`/`attrValue`/`attrTextOf`/`attrValueOf`, `valueFromNodes`, `textFromNodes`), fact
collection (`parseComponentFacts`, `collectComponentFacts`, `emptyComponentFacts`,
`collectSourceFiles`, `ComponentFacts`, `SuppressionDirective`, the `*Fact` types, the kit-module
family), config parsing (`findMinifyDisabled`, the svelte-config family, `project-paths` constants),
the a11y composition helpers (`foldOccurrences`, `decodeFragmentId`, `splitTokens`,
`isTopFragment`, `LANDMARK_ROLES`, `IDREF_ATTRS`, `BranchStep`, `A11yOccurrenceInfo`,
`ResolvedA11y`), the provider boundary types (`HeadTag`, `ResolvedHead`, `HeadProvider`,
`ImageInfo`, `ResolvedImages`, `HeadingInfo`, `ResolvedHeadings`), config application
(`selectRules`, `applyRuleSeverities`, `applyOverrides`, `withFailedRulesOff`, …), rule-option
plumbing (`resolveRuleOptions`, `validateRuleSetting`, `intOption`, …), reporter internals
(`terminalSafe`, palette, app-shell rendering), and `summarize`/`classify`/`effectiveSeverity`.

`ResolvedA11y` and friends being internal is the point: the a11y roadmap's remaining increments
reshape them.

## Remove before 1.0

Exported today, imported by nothing in-repo and named in no doc — publishing them at 1.0 would
freeze surface nobody uses:

- Rule factories `headTagRule`, `imageRule`, `linkRule` (internal builders for ~20 concrete rules).
- The ~90 individual rule functions (`seoTitlePresence` … `a11yNoMissingIdRef`). They are consumed
  only in aggregate via `allRules`, and docs address rules by id. **This retires one of the
  four registration places AGENTS.md mandates** — a simplification the rule-adding workflow has
  wanted since the convention's "TypeScript won't catch a missed spot" warning. `allRules` and the
  per-rule module files stay; only the index re-export list goes.
- App-shell internals `buildHtmlDocument`, `scoreBand`, `BAND_COLOR`, `APP_SCRIPT`, `APP_STYLE`
  (move to `./internal` where vite's UI needs them; drop the rest).
- Overlapping/redundant: `compileOverrides` + `overrideMatches` (steps of `applyOverrides`),
  `validateRuleOptions` (step of `validateRuleSetting`), `isMentionedAnywhere`, `settingOptions`,
  `intOption`/`listOption`/`mapOption` (rule-authoring helpers used only inside core),
  `parseKitModuleFacts`, `resolveRunesModuleSpecifier`, `ViteKitConfigResult`, `RawKitAliases`,
  `FailedRule`, `Classification`, `ConsoleReportOptions`, `CompiledOverride`.

`attrText`/`attrValue` vs `attrTextOf`/`attrValueOf` (same purpose, two call shapes) stay both —
they are internal after the split, so the duplication costs nothing publicly and consolidating them
is a free internal change later.

## Enforcement

A test in `packages/core/test/` reads `src/index.ts`'s export list and compares it to a committed
`public-surface.json` (the frozen list above). A new name in `.` fails the build with "add it to
the frozen surface or export it from ./internal instead". This is the same forcing function the
docs-links and kitchen-sink meta-tests already apply.

`check:publish` (attw/publint) must pass for both entry points.

## Corrections this audit surfaced (fix before the freeze)

- `docs/.../reporters.md` (en + ja) shows `"docsUrl": "https://svelte-vitals.dev/rules/…"` in the
  JSON example, but `docsUrlFor` emits `https://oekazuma.github.io/svelte-vitals/rules/…`. The
  example teaches a URL the tool never produces.
- `SvelteVitalsOptions.overrides` is absent from the plugin-mode options table and the vite README,
  the only plugin option with no doc coverage.

## Sequencing

The `.`/`./internal` split and the removals land **now** (0.x, free). The freeze — the enforcement
test plus the "frozen" wording in the READMEs — lands last, in roadmap Phase E, so the a11y
increments in Phase C can still reshape internal signatures on the way.
