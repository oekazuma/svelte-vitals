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
