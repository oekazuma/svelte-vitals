# Config-file support: `svelte-vitals.config.{ts,js,mjs}` (roadmap item C)

**Date:** 2026-07-05
**Status:** Shipped (plan A — CLI/MCP) (2026-07-07) — loader hardened, wired into `analyzeProject` (CLI `run()` + MCP `analyze` tool), `--weights` CLI flag and MCP `weights` argument added. vite wiring + docs-site updates remain (plan B).
**Packages:** `svelte-vitals` (loader + CLI wiring), `@svelte-vitals/mcp` (inherits via `analyzeProject`), `@svelte-vitals/vite` (wiring approach is an open question, see below), `@svelte-vitals/core` (no code change; `defineConfig` re-export only)

## Goal

Let a team put its svelte-vitals configuration in one file —
`svelte-vitals.config.{mjs,js,ts}` at the project root — instead of repeating
CLI flags, vite plugin options, and MCP tool arguments. This is a 1.0-required
roadmap item: the health-report design doc
(`2026-06-23-health-report-design.md`, "Non-goals / follow-ups") lists
"Config-file support + `--weights` CLI flag (roadmap item C — 1.0-required)",
and the shipped docs already promise "configurable weights"
(`docs/src/content/docs/guides/health-report.md`) with no way to configure
them — this feature closes that documentation gap.

The data-model side is already done: `Config`, `defineConfig` (whose own
comment says "Identity helper for config files (design §6)"), `selectRules`,
and `applyRuleSeverities` are all implemented and exported from
`@svelte-vitals/core`. The only missing piece is finding and reading the file.

This document records six design decisions (each with a recommendation,
rationale, and alternatives), the measured results of a loader prototype
(`packages/cli/src/config-file.ts` + `packages/cli/test/config-file.test.ts`,
spike quality, committed alongside this doc but **not wired into any entry
point**), the wiring plan for the three entry points, a test plan for the real
implementation, and the questions that still need a maintainer decision.

## Background / current state

- `packages/core/src/types.ts` — `Config` (`treatDynamicAs` / `metaComponents`
  / `rules` / `failOn` / `weights?`), `defaultConfig`, and `defineConfig`
  (shallow merge over defaults).
- `packages/core/src/config-apply.ts` — `selectRules` / `applyRuleSeverities`.
- How each entry point receives configuration today:
  - **CLI** — `packages/cli/src/resolve-args.ts` normalizes mri argv into
    `RunOptions` (pure, no I/O, unit-tested); `analyzeProject`
    (`packages/cli/src/index.ts`) builds the `Config` with
    `defineConfig({ treatDynamicAs: opts.treatDynamicAs ?? 'pass', ... })`.
  - **vite** — plugin options in `packages/vite/src/plugin.ts` and the
    dev-hook subset `SvelteVitalsHookOptions`
    (`packages/vite/src/hooks/options.ts`). The vite package depends on
    `@svelte-vitals/core` but **not** on the `svelte-vitals` CLI package.
  - **MCP** — `packages/mcp/src/tools/analyze.ts` calls the CLI's
    `analyzeProject` (the MCP package already depends on `svelte-vitals`).
- `Config.weights` is consumed by `computeHealth`
  (`packages/core/src/scoring/score.ts`: per-category weight default 1,
  negative weights throw `RangeError`, all-zero weights throw `RangeError`)
  but is settable from no entry point.
- Core purity: `packages/core/src/index.ts` — "No `node:` imports, no I/O" —
  so the loader **cannot** live in core.
- Runtime floor (decided in the Node-engines-floor work, PR #124): every
  package pins `"engines": { "node": ">=22.13.0" }`; the repo pins
  pnpm@11.9.0; CI tests Node 22.13.0 / 24.16.0 / 26. This floor is final —
  the maintainer kept Node 22 support because it is maintenance LTS until
  2027-04 — and it directly constrains loader decision 2 below.

## Design decisions

### 1. File names and discovery

**Recommendation:** look for `svelte-vitals.config.mjs`, then
`svelte-vitals.config.js`, then `svelte-vitals.config.ts`, **in the analyzed
directory (`cwd`) only** — no upward search into parent directories. First
match wins; return `undefined` (not an error) when none exists.

**Rationale:** the analysis unit is a SvelteKit project root (the CLI's
positional argument / `process.cwd()`), and that is exactly where
`vite.config.*` and `svelte.config.js` already live — SvelteKit users expect
per-project config at the project root, not cosmiconfig-style upward
discovery. Upward search would also make monorepo behavior surprising (a repo-
root config silently applying to every package).

**Alternatives considered:** (a) upward search — rejected per above; (b) also
accepting `.mts`/`.cts`/`.cjs` — rejected, the repo is ESM-only by design
(issue #20; the CLI's own tsup config comment says "never add 'cjs'"), and
SvelteKit projects are `"type": "module"`, so plain `.js` is already ESM;
(c) a `package.json` `"svelte-vitals"` key — rejected, no precedent in this
ecosystem's tooling and it can't express comments or computed values.

### 2. Loader mechanism

**Recommendation:** plain native `import(pathToFileURL(file).href)` — zero new
dependencies. `.js`/`.mjs` always work on every supported Node. `.ts` is
supported **best-effort**: it works out of the box on Node >= 22.18 and
\>= 23.6 (native type-stripping shipped unflagged in 23.6.0 and was
backported to the 22 LTS line in 22.18.0), but on 22.13–22.17 — the bottom
of the supported floor (>= 22.13.0) — native `import()` of `.ts` fails with
`ERR_UNKNOWN_FILE_EXTENSION` unless the user runs Node with
`--experimental-strip-types`. The loader catches that specific failure and
rethrows a descriptive, actionable error ("upgrade Node to 22.18+, re-run
with --experimental-strip-types, or rename the file to .mjs/.js") instead of
surfacing Node's raw error.

**Measured in the spike** (see `packages/cli/test/config-file.test.ts`):

- On Node 24.18.0, a plain `node --input-type=module -e "import('./x.ts')"`
  (no test runner involved) strips types and returns the module unflagged —
  the native success path is real on the 24 line.
- **Correction (found via a CI failure on the 22.13.0 matrix job):** the
  spike's first `.ts` test called `loadConfigFile` → `import()` **inside the
  vitest process**, and vitest's module runner intercepts and transforms
  in-process dynamic imports — so the `.ts` fixture loaded successfully on
  Node 22.13.0 too, where native import must fail. An in-process test cannot
  observe native type-stripping behavior at all (it "passes" on every Node
  version), so it was **not** evidence of the native path. The test was
  rewritten to spawn a child `node` process
  (`execFileSync(process.execPath, ['--input-type=module', '-e', …])`) that
  performs the dynamic import with no loader hooks, asserting exit 0 on
  22.18+/23.6+ and a non-zero exit with `ERR_UNKNOWN_FILE_EXTENSION` on
  stderr below that. The CI Node matrix (22.13.0 / 24.16.0 / 26) now
  genuinely exercises both native branches (22.13.0 < 22.18, so it stays on
  the error branch).
- This property carries over to the implementation's test plan (plan A):
  **any test of the Node-22 `.ts` error path — including `loadConfigFile`'s
  descriptive re-thrown error — must run in a child process or as a
  `dist/bin.js` e2e**; under vitest that error is unreachable because the
  in-process import always succeeds.
- `.mjs` loading (plain object and `defineConfig`-based) works as expected.

**Constraint to record (final):** `engines.node` is `>=22.13.0`. Native
type-stripping is only unflagged from Node 22.18.0 (LTS backport) / 23.6.0,
so option (b) below does **not** work seamlessly on the bottom of the
supported floor (22.13–22.17). This is the deciding fact of this section.

**Alternatives considered:**

- **(a) `jiti`** — robust `.ts` loading on every Node version, used by
  nuxt/tailwind/eslint's ecosystems. Cost: a new runtime dependency (via the
  pnpm catalog) on all three entry points' dependency chains, plus a second
  module-resolution semantic (jiti's) alongside Node's. Not needed unless the
  maintainer decides seamless `.ts`-on-Node-22 is a hard requirement — in
  which case it slots into the same `loadConfigFile` signature with no design
  change. This is the recorded fallback, not the recommendation.
- **(b) native `import()` for `.ts` unconditionally** — rejected as stated:
  broken on the 22.x floor without a flag.
- **(c) `.js`/`.mjs` only, no `.ts`** — zero-dependency and zero-caveat, but
  worse DX (no typed config without a JSDoc `@type` annotation) and it
  contradicts the roadmap phrasing (`svelte-vitals.config.ts` is the headline
  filename). The recommendation above is strictly a superset of this.

**Reusability across entry points:** the loader is a Node-only module
(`node:fs`, `node:path`, `node:url`), fine for the CLI and MCP (both always
run in Node). In the vite plugin, vite itself can already load `.ts` (users
would more naturally `import` their config inside `vite.config.ts` anyway) —
see decision 5 for where the code lives.

**Implementation note (post-spike):** ESM `import()` caches by URL, so a
long-lived process (vite dev, MCP server) re-reading an edited config file
would get the stale module. A cache-busting query (`?t=${mtime}`) fixes it if
live-reload is ever wanted; the CLI's single-run model doesn't care. The spike
prototype does not cache-bust.

### 3. Priority and merging

**Recommendation:** **CLI flag > config file > built-in default**, applied
**per field** (shallow): a flag that was actually passed overrides only that
field; fields the user didn't flag fall through to the config file; fields in
neither fall through to `defaultConfig`. The `rules` field follows the same
rule as a whole unit: when `--rules`/`--ignore` are passed, the flag-built
rules map replaces the file's `rules` entirely (no key-level merge); when
neither flag is passed, the file's `rules` applies untouched.

**Rationale:** per-field shallow override is what every comparable tool does
(vitest, eslint flat config + CLI) and is the least surprising: a one-off
`npx svelte-vitals --fail-on info` should not discard the team's
`metaComponents`. Whole-field replacement for `rules` (rather than key-level
merge) keeps `--rules SEO001` meaning what it means today — "enable only these
rules" — regardless of what the file says; key-level merging would make the
allow-list semantics of `--rules` (which works by generating `off` entries for
everything unlisted) impossible to reason about.

**Corrected 2026-08-06.** The paragraph above, and the "flag-built rules map
replaces the file's `rules` entirely" sentence that opens this section, apply
that reasoning to `--rules` and `--ignore` alike. It only holds for `--rules`:
its allow-list semantics need whole-field replacement to mean what they say,
regardless of the file. `--ignore` names only the rule(s) it silences and
never claimed anything about the rest — replacing the whole field on its
account was an implementation shortcut (both flags fed one `buildRulesConfig`
call), not a semantic requirement, and it silently dropped every other rule's
file-configured severity/options on any `--ignore` invocation
(rules-flag-clobbers-config-options). `--ignore` now layers `off` entries onto
whatever `rules` resolved to instead of replacing it.

That distinction held only as long as `--rules` used the same encoding:
selection expressed as the _absence_ of a map entry, which a key-level merge
cannot layer — an absent key and an explicit `'off'` become indistinguishable
once merged, so the allow-list's synthesized `off` entries had to replace the
field outright to mean what they said. `rules-flag-keeps-options` replaces
that encoding: `resolveRuleSelection` takes the config file's `rules` map and
an `allowRules` id list as separate inputs instead of folding both into one
synthesized map, so a named rule's `'off'` can be rewritten away without
erasing its severity or options, and an unnamed rule can be set to `'off'`
without touching anyone else's entry. `--rules` still overrides selection — a
config-file `'off'` for a rule it names, since disabling a rule is itself
selection — but no longer needs to replace the whole field to do it, and now
inherits every other setting a named rule declared, the same as `--ignore`
already did for the rules it leaves alone.

**Two implementation subtleties found in the spike:**

- `resolve-args.ts` currently always sets
  `rules: buildRulesConfig(allow, ignore)`, which returns `{}` when no
  flags are given. `{}` must be normalized to `undefined` (meaning "not
  specified") before merging, or an empty flag-side map would clobber the
  file's rules. One-line change at the `rules:` line in `resolveArgs`.
- A config file written with `defineConfig({...})` exports a **full** `Config`
  (defaults already filled in), so "field absent from the file" is not
  distinguishable from "field explicitly set to the default". With the
  precedence above this is harmless — the file-provided default equals the
  built-in default — but it means the merge must be "flag if flagged, else
  file value", never "file value if it differs from default".

**Alternative considered:** config file wins over flags (config-as-policy) —
rejected; flags are the ad-hoc/CI escape hatch and must stay authoritative.

### 4. Validation

**Recommendation:** follow the CLI's existing two-tier convention from
`resolve-args.ts` — warnings print to stderr and analysis proceeds; errors
print to stderr and the CLI exits 2 (execution error, per the exit-code
contract in `bin.ts`):

- **Errors (exit 2):** file exists but cannot be loaded (syntax error, missing
  default export, `.ts` on unflagged Node 22 — all thrown by the loader);
  unknown rule ids in the file's `rules` map (reuse `findUnknownRuleIds` /
  `knownRuleIds` from `packages/cli/src/rules-config.ts`, same message shape
  as the `--rules/--ignore` error); unknown category keys or negative values
  in `weights` (validating early gives a file-and-field error message instead
  of letting `computeHealth`'s `RangeError` surface later without context).
- **Warnings (continue):** invalid enum values for `treatDynamicAs` / `failOn`
  (ignore the field, fall through to flag/default) — mirrors how the CLI
  already treats an unknown `--treat-dynamic-as` / `--fail-on` value as a
  warning, and keeps flag-vs-file behavior consistent for the same mistake.
- Unknown top-level keys: **warning**, not error — forward-compatibility (an
  older CLI reading a newer config file should degrade gracefully pre-1.0).

In MCP, the same conditions become `isError` tool results (the existing
`textError` pattern in `packages/mcp/src/tools/analyze.ts`) rather than
process exits.

**Alternative considered:** full schema validation with zod — the MCP package
already uses zod, but the CLI deliberately has no schema-validation dependency
today and hand-rolled checks for 5 fields are ~40 lines; not worth a new CLI
dependency. Revisit only if `Config` grows substantially.

### 5. Where the loader lives

**Recommendation:** `packages/cli/src/config-file.ts`, exported from the
`svelte-vitals` package's public `index.ts` (alongside the existing
`buildRulesConfig`/`findUnknownRuleIds` re-exports). MCP already depends on
`svelte-vitals` and calls `analyzeProject`, so it inherits the feature with no
new dependency. A new `@svelte-vitals/config` package is overkill for one
~60-line module (a fifth publishable package, changeset wiring, publint/attw
surface — all for code with exactly two consumers).

Additionally, re-export `defineConfig` from `svelte-vitals` (one line — it is
already imported there from core). Rationale: users' config files should be
able to write `import { defineConfig } from 'svelte-vitals'` — the package
they actually installed. `@svelte-vitals/core` is a transitive dependency, and
with pnpm's default strict `node_modules` layout a user-project import of a
transitive dependency fails to resolve. (The spike fixture imports from
`@svelte-vitals/core` and works because the fixture lives inside this
workspace; a real user project can't rely on that.) Document both import paths
but lead with `'svelte-vitals'`.

**vite is the open case:** the vite package intentionally does not depend on
the CLI package, and adding `svelte-vitals` as a dependency of
`@svelte-vitals/vite` just for a 60-line loader drags the whole CLI (clack,
magicast, smol-toml, …) into every vite user's tree. Options, for the
maintainer to pick at implementation time (see Open questions):
(a) duplicate the small loader inside the vite package; (b) don't wire the
config file into vite at all and document `import config from
'./svelte-vitals.config.js'` + spread into the plugin options inside
`vite.config.ts` (vite itself handles `.ts` there, sidestepping decision 2
entirely for vite users); (c) the `@svelte-vitals/config` micro-package after
all. The spike leans (b) as the doc-only zero-cost start, with (a) as the
follow-up if demand shows up — but this is explicitly not settled here.

### 6. `--weights` CLI flag

**Recommendation:** ship `--weights` in the same release as config-file
support, per the health-report design doc's stated pairing ("Config-file
support + `--weights` CLI flag"). Format:

```
--weights seo=2,performance=1
```

- Comma-separated `category=number` pairs; categories are the `Category`
  union (`seo` / `performance` / `correctness` / `security` /
  `architecture`), matched case-insensitively and normalized to lowercase.
- Unknown category or non-numeric/negative value → error, exit 2 (consistent
  with unknown `--rules` ids; `computeHealth` would throw on negatives anyway,
  so reject them at parse time with a better message).
- Unlisted categories keep the default weight 1 (matching `computeHealth`'s
  per-category `?? 1` fallback), so `--weights seo=2` alone means "SEO counts
  double".
- Merging follows decision 3: `--weights` replaces the file's `weights` field
  as a whole when passed.

**Alternative considered:** deferring `--weights` to a later release —
possible (the config file alone already closes the docs gap), but the flag is
~20 lines of `resolve-args.ts` given the config plumbing exists, and the
health-report doc promised them together.

## Wiring plan (implementation, not this spike)

The merge point is `analyzeProject` (`packages/cli/src/index.ts`), which both
the CLI's `run()` and MCP call — wiring it once there gives two entry points
the feature simultaneously:

- **`packages/cli/src/index.ts`** (~20 lines): in `analyzeProject`, call
  `await loadConfigFile(cwd)` and change the `defineConfig({...})` construction
  from `opts.X ?? default` to `opts.X ?? file?.X ?? default` per field; add
  `weights: opts.weights ?? file?.weights`. Validate the file's `rules` /
  `weights` here (throwing a `ProjectError`-style typed error that `run()` and
  MCP already map to exit 2 / `isError`). Add `weights?: Partial<Record<Category, number>>`
  to `AnalyzeOptions` and `RunOptions`.
- **`packages/cli/src/resolve-args.ts`** (~25 lines): parse `--weights` into
  `weights` (validation per decision 6); normalize the empty
  `buildRulesConfig` result to `undefined` (decision 3); no config-file I/O
  here — the module stays pure and unit-testable as designed.
- **`packages/cli/src/bin.ts`** (~5 lines): help text for `--weights` and the
  config file; no structural change (errors thrown from `analyzeProject`
  already reach the exit-2 path).
- **`packages/cli/src/index.ts` exports** (2 lines): `loadConfigFile`,
  `defineConfig`.
- **`packages/mcp/src/tools/analyze.ts`** (0–10 lines): zero changes for the
  base feature (inherits via `analyzeProject`); optionally add a `weights`
  arg to the tool schema for parity.
- **`packages/vite/*`**: per decision 5, pending the open question — either
  ~0 lines (docs-only, option b) or a small duplicated loader + a
  `configFile: false` opt-out (option a).
- **Docs** (`docs/src/content/docs/`, en + ja together per repo convention):
  new config-file guide page; fix the health-report guide's "configurable
  weights" wording to show the actual mechanism; CLI reference for
  `--weights`. Ships with the implementation, not this spike.

Suggested split, per the plan's maintenance notes: **plan A** = loader
hardening + CLI/MCP wiring + `--weights`; **plan B** = vite decision + docs
(en/ja) updates.

## Test plan (implementation)

Spike tests already committed (`packages/cli/test/config-file.test.ts`, 5
cases: no file → `undefined`; plain `.mjs`; `defineConfig` `.mjs`; missing
default export → error; `.ts` branching on Node version). For the real
implementation, add:

- `resolve-args.test.ts`: `--weights` parsing (valid, unknown category,
  negative, non-numeric, case normalization); empty-rules-flag →
  `undefined` normalization.
- `analyze-project.test.ts`: precedence matrix — flag over file, file over
  default, per-field independence; file with unknown rule id → typed error;
  file `weights` reaching `computeHealth` (assert on the returned `config`).
- `run.test.ts` / e2e: fixture project containing a config file, assert
  findings reflect it and that a bad file exits 2 with the loader's message.
- MCP: one test that a project-with-config-file analysis reflects the file.
- The native `.ts` branches are covered by the spike's child-process test
  across the CI Node matrix (22.13.0 exercises the `ERR_UNKNOWN_FILE_EXTENSION`
  path; 24/26 the success path). Per the measured correction in decision 2,
  tests for `loadConfigFile`'s own descriptive Node-22 error must likewise be
  child-process/e2e based (e.g. through `dist/bin.js`) — an in-vitest test of
  that path is meaningless because vitest transforms the import.

## Out of scope

- **Wiring** into `resolve-args.ts` / `bin.ts` / the vite plugin / MCP — this
  spike ships only the design doc, the prototype loader, and its tests.
- **`--weights` implementation** — designed above (decision 6), not built.
- **Docs-site changes** (`docs/src/content/docs/`, en + ja) — land with the
  implementation.
- **New dependencies** — none added; `jiti` is recorded as the fallback only.
- **Baseline / suppression-file support** (audit finding DIR-03) — a separate
  feature; a config file is not a findings baseline.
- **Config live-reload** in vite dev / MCP long-lived processes (see the
  import-cache note in decision 2).
- **Extending `Config`** with output-level options (reporter, `minHealth`,
  `route`, …). Recommendation recorded here for the implementation plan: keep
  the file scoped to the analysis-semantics fields of `Config`
  (`treatDynamicAs`, `metaComponents`, `rules`, `failOn`, `weights`) —
  reporter/output choices are per-invocation concerns and stay flags. If this
  is revisited, it is a `Config`-type design question for core, not a loader
  question.

## Decisions on the open questions (2026-07-07)

1. **Decided — best-effort `.ts`.** Native import stays the loader; no jiti
   dependency. Revisit only if the Node floor moves past 22.18 — raising the
   floor from 22.13 to 22.18 alone would erase the `.ts` caveat entirely, a
   much nearer milestone than the 23.6/24 line.
   (Original question: is "best-effort `.ts`" — unflagged on 22.18+/23.6+,
   descriptive error telling 22.13–22.17 users to upgrade, pass
   `--experimental-strip-types`, or use `.mjs` — acceptable for 1.0, or is
   seamless `.ts` everywhere a hard requirement via `jiti`?)
2. **Decided — option (b), docs-only for vite.** Users import their config
   inside `vite.config.ts`; a duplicated mini-loader (option a) remains the
   follow-up if demand appears.
   (Original question: option (b) docs-only, option (a) duplicated
   mini-loader in the vite package, or (c) a `@svelte-vitals/config`
   micro-package?)
3. **Decided — leave the health-report wording until the implementation
   ships.** Plan A/B will fix it together with the new config-file guide.
   (Original question: soften the health-report guide's "configurable
   weights" wording now, or leave it until plan A/B land? Flagged as DOCS-01
   in the originating audit.)
