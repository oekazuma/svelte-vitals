# CLI migration to gunshi — adoption plan

Date: 2026-08-10
Status: Approved (maintainer, 2026-08-10) — phases proceed in order, gated as written
Origin: maintainer initiative — raise CLI robustness and make command development/maintenance
easier by adopting [gunshi](https://gunshi.dev/).

## Verified facts about gunshi (as of 2026-08-10)

- **gunshi 0.37.1**, published 2026-07-19; active cadence (0.35.x → 0.37.x in recent weeks);
  **pre-1.0**, so breaking changes are permitted by semver.
- **Zero runtime dependencies** — confirmed from the full npm packument (`dependencies: {}`),
  not the README: the `args-tokens` parser it is built on is inlined at build time, and
  `args-tokens` itself is also zero-dependency. Adopting gunshi adds exactly one package to the
  published CLI's dependency tree.
- `engines.node: ">= 22"` — compatible with the published floor (`>=22.13.0`); ESM
  (`type: module`), matching the repo's esm-only publishing profile; MIT; maintained by kazuya
  kawaguchi (vue-i18n); ~234 KB unpacked.
- API surface relevant here: `define()` (declarative, typed args: `string`/`boolean`/`number`
  types, `short` aliases, descriptions), `cli(argv, command, { subCommands, fallbackToEntry })`,
  lazy-loadable sub-commands, auto-generated usage/help, pluggable renderers, a plugin system
  with lifecycle hooks, i18n via the separate optional `@gunshi/plugin-i18n` package (the
  renderer/global plugins ship inside `cli()`; i18n does not), `choice`/`positional` combinators.

## What it buys this repo (mapped to today's code)

- **Kills the help-drift defect class.** Five command surfaces each carry hand-written help
  text (`bin.ts` ~139 lines of dispatch + HELP template; `docs`, `explain`, `install`, `ci`
  each own theirs). This class has already produced shipped bugs fixed in past releases (a
  scaffolded skill header advertising a flag that had been renamed; `docs show` not mentioning
  `explain`). Generated usage from the arg declarations removes the divergence mechanism, not
  just today's instances.
- **`fallbackToEntry` matches the existing dispatch quirk exactly**: sub-command names win over
  same-named directories, and an unknown first positional falls through to the root analyzer
  (`svelte-vitals ./apps/web`), which is precisely the documented current behavior.
- **Lazy sub-commands** take `@clack/prompts` (used only by `install`/`ci`) off the hot
  analyze path.
- **Typed `ctx.values`** subsumes the mechanical half of argument handling (`cli-args.ts`,
  40 lines over `util.parseArgs`, plus the coercion parts of `resolve-args.ts`). Domain
  validation (rules×category conflicts, `--min-health` range, git ref checks) stays ours,
  outside gunshi.
- **Future option: bilingual help.** gunshi's i18n plugin (`@gunshi/plugin-i18n`, a separate
  optional package whose own dependency footprint must be evaluated then) could serve `ja` help text — a
  natural fit for a repo that already maintains en/ja docs in lockstep. Not part of this plan;
  recorded as a follow-on candidate.

## Costs and tensions (stated plainly)

1. **Direction reversal.** The repo removed `mri` in favor of the Node builtin
   `util.parseArgs` (#392) days before this proposal. gunshi is a larger commitment than `mri`
   ever was — a 0.x framework as a runtime dependency of a published CLI. The zero-dependency
   finding softens the supply-chain shape (one package, no tree), but the reversal is real and
   is this plan's core tradeoff: builtin-minimalism traded for the elimination of the
   help-drift class plus declarative command surfaces.
2. **0.x churn.** Policy if adopted: exact pin in the workspace catalog (no `^`), Renovate
   bumps gated by the Phase-0 characterization suite, and any breaking bump treated as a
   design-review event, not a routine merge.
3. **Help output changes shape.** Generated usage will not be byte-identical to today's
   hand-written text — a user-visible change requiring a declared-movement changeset (exit
   codes and error semantics must NOT move; only help formatting may).
4. **Alternatives not comparatively evaluated.** The maintainer selected gunshi; commander/
   citty/clipanion et al. were not scored against it. The phased gates below protect against
   unfitness regardless of which framework had been chosen: if gunshi fails a gate, the
   fallback is the status quo, not a different framework.

## Contracts that must not move (the migration's invariants)

- Exit codes: analyzer `0`/`1`/`2` per `bin.ts`'s documented contract; sub-commands `0`/`2`
  with stdout left empty on every exit-2 path — one known exception, recorded by Phase 0's
  characterization rather than papered over: `ci <unknown-subcommand>` currently prints its help
  to stdout before exiting 2. Phase 2 must either fix that path to stderr (a declared movement)
  or accept the exception deliberately; the contract test pins today's behavior either way.
- `svelte-vitals: …` stderr prefix and wording of error diagnostics (agents and CI scripts
  match on these).
- Reporter stdout purity (`--reporter json`/`sarif` must remain machine-parseable; nothing new
  on stdout).
- Flag-guard semantics from #397/#383: 11 value-carrying flags reject empty and `-`-leading
  values; `--out-file -`/`--out-file=-` accept the literal `-`; `--diff` exempt.
- In-process testability with injected IO (`CliIO`), which the entire cli test suite rides on.

## Phased plan (each phase has a gate and an off-ramp)

### Phase 0 — characterization suite (no gunshi; no-regrets)

Golden tests for all five command surfaces: help output, error wording, exit codes for the
full flag-guard matrix, plus a built-binary E2E for the gate flags (`--fail-on`,
`--min-health`) — this is exactly audit backlog items 2608-TEST-01/03 (bin.ts in-process seam +
built-dist E2E), so it ships on its own merits even if gunshi is ultimately rejected. The
gunshi go/no-go can be made after this exists.

Gate: suite green against current `main`. Off-ramp: none needed — this phase is independently
valuable.

### Phase 1 — spike on the `docs` sub-command (worktree only; not merged)

Port the smallest surface (`docs/cli.ts`, ~106 lines, pure) to gunshi and prove the three
load-bearing facts research could not verify from documentation:

- (a) The exit-code/stderr/stdout contracts are reproducible (renderer/plugin override depth —
  gunshi's docs do not spell out exit-code behavior; this must be measured).
- (b) `args-tokens` parsing reproduces the #397/#383 guard class (empty `--flag=`, `--flag -x`
  rejection, literal `-` acceptance for out-file) or can be wrapped to.
- (c) In-process runs with injected IO work (no process-global coupling that breaks vitest).

Gate: all three proven against the Phase-0 suite, plus startup-time and install-size deltas
measured. Off-ramp: if any fails and wrapping is not clean, **stop — keep `util.parseArgs`**,
retain Phase 0's suite, record the outcome here as a dated addendum.

### Phase 2 — root analyzer + `explain`

`define()` the analyzer's args; `cli()` with `subCommands` + `fallbackToEntry`
(entry point superseded by the Phase 1 verdict below: `gunshi/bone` — the zero-plugin subpath
export of the same pinned `gunshi` package, not a separate package; `subCommands`/`fallbackToEntry`
come from the shared `cliCore` dispatcher and were verified identical under bone);
`resolve-args.ts` keeps all domain validation. Full characterization suite must stay green
except deliberately-updated help goldens. This phase changes user-visible surfaces, so it gets
the independent fresh-context review treatment on top of the standard adversarial review.

### Phase 3 — `install`/`ci` as lazy sub-commands; deletion pass

Lazy-load the clack-dependent commands; delete the hand-written HELP templates,
`cli-args.ts`, and the dispatch half of `bin.ts`. The migration is only worth finishing if
this deletion lands — a half-migrated CLI (two arg systems) is strictly worse than either end
state, so Phase 2 and 3 should land in adjacent releases.

Changesets: Phase 0 none (tests only); Phases 2–3 `svelte-vitals` patch-or-minor with the
help-format movement declared explicitly (maintainer call on patch vs minor at PR time).

## Decisions (maintainer, 2026-08-10)

1. **Help format**: accept gunshi's generated format — one declared golden update when Phase 2
   lands; no compatibility renderer.
2. **Timing**: before v1.0. Rationale: the recent run of CLI defect fixes is the motivating
   signal, and the characterization suite plus phase gates carry the 0.x risk.
3. **Phase 0 approved first**: the characterization suite lands before any gunshi code, so the
   migration diffs are judged against pinned behavior.

## Phase 1 verdict (2026-08-10) — all three gates pass; proceed to Phase 2 on `gunshi/bone`

Spike branch: `spike/gunshi-phase1` (commit 7d97b97b, pushed but never merged; read the full
narrative with `git show spike/gunshi-phase1:packages/cli/SPIKE-FINDINGS.md` — the path does not
exist on `main`; 36 probe tests). Gate outcomes:

- **(a) contracts — pass-with-wrapper.** The `docs` port reproduces every design-doc cell
  byte-for-byte except `--help` (exit 0 holds; text differs, which decision 1 already accepts).
  Mechanisms that make it work: exit codes travel through a per-invocation closure (`cli()`
  discards non-string runner returns); `usageSilent: true` is a documented seam that routes every
  internal gunshi write through a no-op, proven global-write-free by spies on
  `console.*`/`process.std*.write`; `fallbackToEntry: true` lets unmatched sub-command tokens
  reach our own runner so current wording is reproducible verbatim.
- **(b) parsing — pass-with-wrapper.** args-tokens diverges from the #397/#383 guard in one real
  way: an empty value (`--reporter=` / `--reporter ''`) is silently dropped instead of rejected —
  post-parse detection is impossible (the value never appears), so the proven ~15-line wrapper
  pre-scans raw argv with the same flag list and the same `--out-file -` exemption.
  Flag-like-value consumption (`--reporter --score`) is structurally safe in args-tokens (keys off
  the leading dash), `--out-file -`/`=-` match exactly, unknown flags are silently ignored exactly
  as today, and the 0–100 `--min-health` range check was always ours.
- **(c) in-process testability — pass, clean.** Injected-IO capture works with zero global
  patching, matching the Phase-0 harness pattern.

**Phase 2 builds on `gunshi/bone` — the subpath export of the pinned `gunshi` package, not a
separate npm package — instead of full `cli()`.** Decided on spike evidence: `cli()`'s
`global()` plugin force-installs `-h`/`-v` on every command with no opt-out (`options.plugins` is
additive), silently hijacking `docs list -v` into printing `"unknown"` on stdout with exit 0 —
a stdout-purity and control-flow regression against a flag the CLI never defined; and its
decorator throws on any validation error while discarding the rendered message, leaving only
gunshi's English fallback text — directly hostile to reproducing this repo's exact stderr
wording. `bone` (same `cliCore` dispatcher, empty plugin array — `subCommands`/`fallbackToEntry`
confirmed identical) avoids both classes structurally, at the cost of auto-usage text this
migration replaces with hand-controlled text anyway.

**LLM-assisted implementation (maintainer instruction, 2026-08-10): every phase that writes
gunshi code MUST consult `@gunshi/docs`** — gunshi ships its guide and API reference as
llms.txt-format markdown (`@gunshi/docs`, versioned in lockstep with gunshi, 0.37.1). Mechanism:
add it to the workspace catalog as a devDependency at Phase 2 start (exact pin, bumped together
with `gunshi` so the docs never describe a different version than the installed API), and every
executor prompt for gunshi work points at `node_modules/@gunshi/docs/**.md` as the primary API
reference — ahead of web fetches, which may describe a newer gunshi than the pinned one. (The
package's `npx @gunshi/docs` auto-setup writes Claude Code skill files; the devDependency +
explicit-pointer route is preferred here because executors run in disposable worktrees where a
committed dependency is the only reliably present artifact.)

Implementation facts Phase 2 must carry: `ctx.positionals` includes the matched sub-command's own
path tokens (undocumented) — recover argv-after-subcommand with
`ctx.positionals.slice(ctx.commandPath.length)`, and because that invariant is unsupported
upstream, every ported command pins it with an explicit regression test so a gunshi bump that
changes the shape fails as a named test, not a mystery; boolean `--flag=false` is truthy to
args-tokens — `parseCliArgs`'s literal-'false' coercion moves into the same raw-argv pre-scan
wrapper as the gate-(b) guard when `cli-args.ts` is deleted in Phase 3 (one shared normalization
layer ahead of gunshi, never per-command re-implementations); `--no-color`-style negation is a
per-flag `negatable: true` schema opt-in, not automatic. Measurements: gunshi 0.37.1 occupies 304 K on disk in the pnpm store (`du -sh`; the registry's
`unpackedSize` metadata reports ~234 KB — filesystem block overhead accounts for the gap), packs
to a 53.8 kB tarball, and installs zero dependencies (args-tokens confirmed inlined). Import cost
≈5 ms — median of 10 runs of `node --input-type=module -e "import('gunshi')"` minus the bare
`node -e 0` floor on the same machine — against the CLI's current ≈157 ms `--help` startup.

## Correction (2026-08-10, phase-2b): unknown-flag passthrough was only partially verified

Phase 1 gate (b)'s cell "unknown flags are silently ignored exactly as today" is falsified for
one argv shape the spike never exercised: args-tokens treats any UNDECLARED option as
string-like, so a positional immediately following it is consumed as that option's value —
`node:util`'s `parseArgs(strict:false)` treats the same shape as boolean and leaves the
positional alone. The spike exercised no unknown-flag-before-positional shapes on any surface —
not "docs/explain have none to lose": `docs show <name>` and `explain <rule-id>` each have a
declared positional too, and both were equally vulnerable (`docs show --typo config` regressed to
"needs a topic name" instead of printing the topic, same class as the analyzer's
`svelte-vitals --typo ./apps/web` silently analyzing the wrong directory). `stripUnknownFlags` is
therefore shared (`guard.ts`) and applied to all three surfaces, parameterized per command by its
family-wide known-flag set — every sub-command of a family must declare every family flag even if
unused, since gunshi resolves each sub-command's args independently (`docs show` never reads
`--json`, but must still declare it so gunshi doesn't treat it as unknown and swallow the topic
name after it). A second, analyzer-only layer, `neutralizeBareDiffAndBaseline` (rewrites a bare
`--diff`/`--baseline`, judged on original-argv adjacency, into a self-contained `=value` token so
a stripped token can never expose a following positional to them), and a third, shared layer,
`splitAtTerminator` (splits argv at the first literal `--` before guard/strip run at all, since
neither understands the terminator and would otherwise reinterpret a post-`--` token that merely
looks like a flag), round out the compensation. `--diff`/`--baseline` values themselves come from a
shadow parse of the untouched original argv through the legacy `parseCliArgs` — the one remaining
use of that parser on the migrated path, which Phase 3's deletion pass must absorb (inline the
value-shape logic) before removing `cli-args.ts`.

## Phase 3 verdict (2026-08-10): `install`/`ci` ported, `cli-args.ts` deleted, two scope calls

`install` (`gunshi/install.ts`) and `ci` (`gunshi/ci.ts`) are ported; `docs/cli.ts`'s and
`explain.ts`'s dispatch functions, `parseRunArgs`'s dependency on `cli-args.ts`, and
`install/args.ts`'s dependency on it are gone; the file itself is deleted. Two calls diverged from
a literal reading of this doc's Phase 3 description, both forced by "never at the cost of a
byte-level behavior change":

- **`parseRunArgs` (now in `resolve-args.ts`) and `parseInstallArgs` (`install/args.ts`) survive**,
  each with its own inlined `node:util.parseArgs` call, instead of disappearing along with
  `cli-args.ts`. Both remain structurally necessary: a guard hit on a value-carrying flag can't be
  turned into a synthesized error message, because the flag's _actual_ consumed value (e.g. the
  literal string `'--json'` when `--reporter --json` lets `--reporter` swallow the next flag) only
  exists after a full legacy-shaped re-parse — `resolveArgs`/`resolveInstallArgs` need that value to
  produce their real, existing error wording. `cli-args.ts`'s own generic `parseCliArgs` wrapper is
  what's gone; each surviving parser is now a small private function scoped to its one caller.
- **`ci`'s outer dispatch (`ci`/`ci install`/`ci upgrade`) is a literal `args[0]` string compare,
  never routed through `guardArgs`/`stripUnknownFlags`/tail-promotion.** Unlike `docs`, `ci` has no
  positional argument to protect from being swallowed, and the promotion trick docs.ts needs to
  reach `list`/`show` through `fallbackToEntry` would here dispatch shapes the legacy runner never
  did: `ci -- install` would actually run install (legacy: help + exit 2); `ci --bogus install`
  would drop `--bogus` and run install, writing a file legacy never touched. gunshi only takes over
  _inside_ the matched `install`/`upgrade` arms.

`install`'s guard-error fallback also differs in kind from the root analyzer's: every analyzer
guard hit is fatal in `resolveArgs`, so the fallback there just re-derives the error text. Install
has non-fatal guard-firing shapes (a bare trailing `--client` parses to legacy's `true`, which
`resolveInstallArgs` treats as "not passed") that are indistinguishable, pre-parse, from the
genuinely dangerous ones (`--client --force` legacy-consumes `--force` as a literal string) — so
install's fallback re-runs the _entire_ legacy pipeline (parse → help check → resolve → dispatch)
rather than assuming a guard hit is always exit 2.

## Addendum (2026-08-11): shell completion via `@gunshi/plugin-completion`

Added `svelte-vitals complete <bash|zsh|fish|powershell>` (`packages/cli/src/gunshi/complete.ts`),
wired as a sixth reserved top-level token in `runCli` (cli.ts), dispatched unsliced (see the
file's own doc comment for why) and loaded lazily, same as `docs`/`explain`/`install`/`ci`.

**The plugin never touches the five real gunshi surfaces — a dedicated, completion-only command
tree instead.** Proven necessary, not merely simpler: temporarily wiring `completion()` into
`docs.ts`'s own `cli()` call left the full characterization suite green (help-golden,
cli-contract, both parity suites — 72 tests), but `docs complete` silently changed behavior —
`complete` is a plugin-added sub-command, added automatically wherever the plugin is installed,
so it shadowed the existing "unknown docs subcommand" exit-2 path with the plugin's own directive
line on stdout, exit 0. None of the characterization suite's existing cases exercise the literal
token `complete`, so this collision is real but was invisible to the suite — recorded here so a
future attempt to fold completion into an existing surface's `cli()` call re-derives the same
finding instead of re-discovering it. The completion tree (`buildCompletionTree` in complete.ts)
is therefore a second, parallel set of `define()` calls, built fresh per invocation (race-safety,
matching every other surface's convention) with no-op `run`s — `@gunshi/plugin-completion` only
ever reads `.args`/`.subCommands` off them via its `onExtension` hook; the command that actually
executes for a `complete` invocation is the `complete` sub-command the plugin adds itself via
`ctx.addCommand`. Every arg schema in that tree is imported from the real surface's own exported
`*_ARGS` const (`ROOT_ARGS`, `DOCS_ROOT_ARGS`/`DOCS_LIST_ARGS`/`DOCS_SHOW_ARGS`, `EXPLAIN_ARGS`,
`INSTALL_ARGS`, `CI_ARGS`/`CI_UPGRADE_ARGS`) — hoisted from inline literals to module-level
exports where they weren't already (docs.ts, explain.ts), never re-declared, so a flag added to a
real surface is visible to completion automatically.

Three empirical gotchas, confirmed against 0.37.1, none documented in `@gunshi/docs` or the
plugin's own README:

- **The entry command's own args vanish from completion when `cli()`'s `subCommands` option is
  empty AT CALL TIME.** `createInitialSubCommands` only splices a copy of the entry command into
  the internal subCommands map (flagged `.entry: true`, later found via `.find(cmd => cmd.entry)`
  in the plugin's `onExtension`) when `options.subCommands` is already non-empty _before_ any
  plugin's `setup()` runs; with zero declared subCommands, the plugin's own `addCommand('complete',
...)` is the only entry in that map by the time `onExtension` reads it, so root-level flags
  silently disappear instead of erroring. Not a concern for this tree (it always declares
  `docs`/`explain`/`install`/`ci`), but real enough that an isolated repro (a bone `cli()` call
  with no `subCommands` at all, plus the completion plugin, querying `--` for entry-level flags)
  is worth keeping in mind before ever adding a leaner completion entry later.
- **The registration loop has no `toKebab`/`hidden` awareness.** It reads `Object.entries(args)`
  and registers each flag under the literal object key, with no schema-driven kebab-casing and no
  hidden check. `ROOT_ARGS`'s `noSuppressions`/`noColor`/`noAnimation` (declared camelCase +
  `toKebab: true` specifically to dodge a _different_ renderer quirk — see analyze.ts's own doc
  comment) would complete as `--noSuppressions` etc., which the real CLI does not parse; install's
  `scope` (`hidden: true`, kept parseable only so an unrecognized flag doesn't swallow a following
  positional) would still be offered. `forCompletion()` in complete.ts compensates: kebab-cases a
  `toKebab` key via `kebabnize` (imported from `gunshi/utils`, not reimplemented) and drops
  `hidden` entries before handing the args to `define()`.
- **Cosmetic wart, accepted rather than worked around:** the plugin's own description-localization
  strips a literal `no-` prefix from an arg key before looking up its schema (treating it as an
  auto-generated negation, the same class of behavior analyze.ts's doc comment already describes
  for gunshi's _renderer_) — since `forCompletion()`'s kebab-cased key IS `no-suppressions` (not a
  negation of a `suppressions` flag that doesn't exist), the lookup misses and falls back to the
  stripped key itself as the "description": `--no-suppressions` completes with the one-word
  description `suppressions` instead of its real description. The completion _value_ is correct;
  only the description text is degraded. Not pinned by a test — pinning today's wrong-but-harmless
  string would fail a future gunshi bump that fixes it, for no benefit (nothing here reads or
  depends on the description text).

**Dependency footprint correction.** The "exactly one package" framing in this doc's Verified
Facts section describes core gunshi adoption and remains true for that decision; it does not
extend to this optional feature. `@gunshi/plugin-completion` itself depends on `@gunshi/plugin`
and `@bomb.sh/tab` (both real, newly-installed packages), and declares a **non-optional**
`peerDependency` on `@gunshi/plugin-i18n` — no `peerDependenciesMeta` marks it optional at the npm
metadata level, even though the plugin's own runtime plugin-dependency graph treats i18n as
optional (`dependencies: [{ id: 'g:i18n', optional: true }]`) and this integration never imports
or configures it. Net effect: `pnpm install` here resolved `@gunshi/plugin-i18n` into the lockfile
solely to satisfy that peer declaration (confirmed via the lockfile diff — it is not physically
linked into `packages/cli/node_modules`, so it adds resolution weight but not an import-time
cost), and an npm end-user installing the published `svelte-vitals` package will get it
auto-installed for real, since npm auto-installs unmet non-optional peers by default. Four new
packages total reach some form of "installed" for this feature
(`@gunshi/plugin-completion`, `@gunshi/plugin`, `@bomb.sh/tab`, `@gunshi/plugin-i18n`), not zero
and not one; import cost is unaffected on the analyzer hot path either way, since `complete.ts` is
reached only via a dynamic `import()` behind the new `complete` token.

## Addendum (2026-08-11): docs-site CLI flag reference generated from the arg declarations

Adoption item 4. The docs site hand-documented flags in prose (`docs/src/content/docs/guides/
(setup)/cli.md`'s `## Flags` section, one `### --flag` per entry; `install.md`'s `## --flag`
sections) — the last remaining home of the help-drift class this migration otherwise already
killed for `--help` itself. `docs`/`explain`/`ci`'s sections in `cli.md` only ever mention their
flags inline (`docs list [--json]`, prose examples), never as an enumerated per-flag reference, so
they were left hand-written rather than generated — nothing there to keep in sync mechanically,
and generating one would be a page nobody asked for.

**Mechanism: a new tsup entry, not a TypeScript-source import.** Plain `node` (the generator runs
outside vitest) strips a single file's types but does not resolve the `.js`-specifier-pointing-at-
a-sibling-`.ts`-file convention every `gunshi/*.ts` module uses internally (confirmed empirically —
`node b.ts` importing `./a.js` when only `a.ts` exists throws `ERR_MODULE_NOT_FOUND`, with or
without `--experimental-strip-types`). `ROOT_ARGS`/`INSTALL_ARGS` were already hoisted to
module-level exports for `gunshi/complete.ts`'s benefit; `packages/cli/src/gunshi/registry.ts` is a
one-more-hop barrel re-exporting just those two (not all five — `docs`/`explain`/`ci` have no
generated table to feed), built as its own `tsup.config.ts` entry (`gunshi-registry`, object-form
so the output name is pinned to `dist/gunshi-registry.js` rather than left to esbuild's outbase
inference) and deliberately **not** added to `package.json`'s `exports` map — generator-only
plumbing, not a documented library surface. `sideEffects: false` lets esbuild tree-shake the rest
of `analyze.ts`/`install.ts` (clack prompts, `readPackageVersion()`, etc.) out of that entry;
verified empirically at 385 bytes built. `scripts/gen-cli-reference.mjs` imports from that dist
file (`pnpm --filter svelte-vitals... build` runs first, matching `gen:rules-index`'s own
build-then-import precedent); the committed-vs-generated **test**
(`packages/cli/test/cli-reference.test.mjs`) instead imports `ROOT_ARGS`/`INSTALL_ARGS` straight
from `../src/gunshi/{analyze,install}.js` — vitest's transform resolves those specifiers, so the
test catches drift even against a stale or unbuilt dist, which reading through dist could not.

**Shape: a Markdown table rendered directly from the `ArgSchema` objects, not `generate()`'s
terminal-formatted text.** `generate()` (from `gunshi/generator`) — the same function
`analyze.ts`/`docs.ts`/`explain.ts`/`install.ts`/`ci.ts` already call to build their hybrid
`--help` text — renders an `OPTIONS:`-headed, fixed-width-aligned block meant for a terminal;
pasted into a Markdown page it would need a `text` code fence, losing table semantics, links, and
scanability. `@gunshi/docs`'s own "Generating Unix Man Pages" guide
(`node_modules/@gunshi/docs/src/guide/advanced/docs-gen.md`) demonstrates exactly the alternative
used here: iterate `Object.entries(args)` and render a custom Markdown structure from `type`,
`short`, and `description` directly — the guide's own "Leveraging Custom Renderers" / "Enhancing
Generated Content" sections recommend this for non-terminal targets. The table's **Flag** column
mirrors what `--help` actually renders (verified against the built CLI): the value placeholder is
the arg's own kebab-cased key, e.g. `--out-file <out-file>`, never an invented metavar (no current
arg sets `ArgSchema.metavar`) — this is why the placeholder never drifts, it has no independent
source. `toKebab` args (`--no-suppressions` etc.) are kebab-cased via `gunshi/utils`'s `kebabnize`
(imported, matching `complete.ts`'s own `forCompletion` — never reimplemented), and `hidden`
entries (install's obsolete `scope`) are dropped, matching both `--help` and the completion tree.

**"Byte-for-byte" means the words, not the raw bytes.** A table cell cannot hold a literal newline;
`INSTALL_ARGS.client`/`app`/`refresh` wrap across several lines for terminal `--help`. The
generator collapses internal whitespace to single spaces and escapes `|` (several descriptions are
enum-style, e.g. `--reporter`'s "console | json | agent | ...") — every word `--help` prints
survives, only the terminal-oriented line-wrapping doesn't. The drift test compares through
`normalizeBlock` (imported from `rules-index.mjs` — oxfmt's own table repadding and prose
rewrapping already required exactly this comparison-not-string-equality strategy there, reused
as-is rather than reimplemented).

**Insertion: HTML comment markers (`<!-- cli-reference:start/end -->`) in plain `.md` files**, not
`rules-index.mjs`'s `{/* ... */}` JS-comment markers — that style exists solely because MDX
(`@mdx-js/mdx`) rejects raw HTML comments, and `cli.md`/`install.md` are plain Markdown, where
standard HTML comments are simpler and need no MDX workaround. The table sits right after each
page's `## Flags`/`## --client <ids>` intro, above the pre-existing hand-written per-flag prose
sections (which stay exactly as authored — usage examples, cross-links, edge-case notes the
one-line `--help` descriptions never carried, and this generator does not touch).

**ja pages embed the same English-generated block** (`gen-cli-reference.mjs` writes one rendered
table into all four files: `cli.md`/`install.md` × en/ja) — flag names and descriptions are English
in the `ArgSchema` declarations today, so translating them per-locale would itself be a duplicated,
driftable copy. Each ja page carries one hand-written sentence outside the markers noting the block
regenerates from ja resources once i18n adoption (item 2, `@gunshi/plugin-i18n`) lands; the test
pins en/ja byte-identity so a future edit can't translate one side without the other unnoticed.

No changeset: doc-site content plus an internal generator/test/build-entry, zero change to any
published package's runtime behavior or public export surface (`gunshi-registry` is a build
artifact, not an `exports` entry).

## Addendum (2026-08-11): `did you mean …?` suggestions via `@gunshi/plugin-suggestion`'s matcher, not its plugin

Probed `@gunshi/plugin-suggestion@0.37.1` (added to the catalog, exact pin, alongside the other
`gunshi`-family packages) to determine whether it could fire on any of this CLI's five real
surfaces. It cannot, confirmed two ways — reading the pinned `gunshi` 0.37.1 source
(`cliCore`/`resolveCommandTree` in `node_modules/gunshi/lib/core-*.js`) and a live probe reproducing
this repo's exact bone wiring:

- The plugin decorates gunshi's own `CommandNotFoundError`/`ArgsValidationError` rendering — it
  detects nothing itself (its own README says so). Both error kinds are structurally unreachable
  here: `fallbackToEntry: true` (every sub-commanded surface, i.e. `docs`) resolves an unmatched
  first-level token straight to the entry command inside `resolveCommandTree` — `targetCommand` is
  already truthy by the time `cliCore` checks whether to construct a `CommandNotFoundError`, so it
  never is, at any `strict` setting. `stripUnknownFlags` (guard.ts) removes any undeclared flag
  before gunshi's own parser ever sees the token, so `ArgsValidationError`'s `unknownOption` case
  (which only fires when `cliOptions.strict` is true AND the parser actually saw the flag) is
  equally unreachable — and no surface here sets `strict: true` regardless. A probe script wiring
  `suggestion()` into a `docs`-shaped bone `cli()` call (subCommands + `fallbackToEntry: true`,
  both `strict` settings) confirmed this empirically: the entry `run()` always received the
  mismatched token as an ordinary positional, `ctx.validationError` always `undefined`. Flipping
  `fallbackToEntry: false` (not this CLI's shape, tested only to see what the plugin _would_ have
  produced) reproduces the OTHER already-recorded Phase-2 finding instead: `bone`'s decorator throws
  a raw `Error` on any validation error, discarding the rendered/decorated message — so the plugin's
  hint text is unreachable there too, for the same class of reason full `cli()` was rejected for in
  Phase 2. `ci` doesn't run its sub-subcommand split through gunshi at all (a literal `args[0]`
  compare, by design — see Phase 3 verdict above), so it was never a candidate either.
- The package DOES export a reusable, non-hand-rolled matcher, unrelated to its plugin/error-hooking
  half: `import { levenshtein, defineSuggestNames } from '@gunshi/plugin-suggestion'`.
  `levenshtein(a, b): number` is a plain edit-distance function; `defineSuggestNames(options)`
  is the plugin's own candidate-ranking factory (filter by `maxDistance`, sort by distance then
  input order, cap at `maxSuggestions`) — the same one its `suggestion()` plugin builds internally.
  `resolveSuggestionOptions` (translates partial user options to defaults: `maxDistance: 2`,
  `maxSuggestions: 1`) is NOT exported, so the default threshold is reproduced by hand at the one
  call site (`gunshi/guard.ts`'s `suggestClosest`) instead of imported — values only, not logic.

Shape chosen: `suggestClosest(typed, candidates)` in `gunshi/guard.ts`, built once from
`defineSuggestNames`, called directly from each surface's own existing error path — never wiring
`suggestion()` into any `cli()` call, since (per above) it would be dead weight. Four surfaces:
root `runAnalyzeCliGunshi` (a `did you mean` line appended after the `No SvelteKit project found`
message, gated on the explicit path not existing on disk at all — an existing directory of that name
is always analyzed, never redirected), `docs`'s and `ci`'s unknown-subcommand paths, and `explain`'s
unknown-rule-id path (scanning 70+ ids per call is well under a millisecond — `defineSuggestNames`
is a single filter+sort over the candidate list, no measurable cost). Every insertion is additive:
the existing error line(s) print unchanged, in the same order, with the hint as one new line: right
after the specific "unknown …" complaint (docs/explain), right before the unchanged `CI_HELP` block
(`ci`, which has no per-token complaint line to append after), or as the sole new line (root, which
had only the one message).

Dependency footprint: `@gunshi/plugin-suggestion` depends on `@gunshi/plugin` and peer-depends on
`@gunshi/plugin-i18n` (same non-optional-peer shape as `@gunshi/plugin-completion`, this doc's prior
addendum) — both were already resolved into the lockfile by `@gunshi/plugin-completion`, so adding
this package resolved **zero new packages** (confirmed via lockfile diff: only
`@gunshi/plugin-suggestion` itself gained entries).

Unlike `@gunshi/plugin-completion` (reached only via the dynamic `import()` behind `complete`),
`suggestClosest` lives in `gunshi/guard.ts`, which `gunshi/analyze.ts` — the root analyzer,
statically imported by `cli.ts` and therefore on every invocation's hot path, not behind a dynamic
import — already imports. So this DOES add to the hot path, unlike the completion feature; measured
rather than assumed: median of 10 runs of `node --input-type=module -e "import('@gunshi/plugin-
suggestion')"` minus the bare `node -e "import('node:path')"` floor on the same machine is ~1 ms
(the package is a single small file depending only on the already-resolved `@gunshi/plugin`), and
`svelte-vitals --help` end to end still runs ~130 ms, in line with this doc's own pre-existing
gunshi-adoption baseline (~157 ms) rather than measurably above it.
