# The GitHub Action runs the project's own svelte-vitals

**Date:** 2026-11-11
**Status:** Draft, awaiting review
**Repositories:** `oekazuma/svelte-vitals-action` (the action), `oekazuma/svelte-vitals` (`ci install` scaffold, docs)

## Problem

The action bundles one version of the analyzer into `dist/index.js` and analyzes every project with
it. The project has its own `svelte-vitals` version, the one developers run locally and write
`svelte-vitals.config.*` against. Nothing ties the two together:

- The scaffolded workflow pins the action by commit SHA, and the project pins `svelte-vitals` in
  `package.json`. Renovate, Dependabot and `ci upgrade` move them independently.
- The pin the CLI bundles always trails. An action release can only bundle a CLI that already
  exists, and the CLI that names that action release ships after it.

When the versions differ:

- **CI fails on a valid config.** An unknown rule id in `rules` or `overrides` is a fatal config
  error (exit `2`). A rule added in the project's CLI and configured there is unknown to an older
  bundled analyzer, and a rule removed or renamed in a newer bundled analyzer breaks an older
  config.
- **CI and a local run disagree.** Findings differ in both directions, so the `failOn` gate passes
  in one place and fails in the other.

A second defect sits next to it. The scaffolded workflow has no install step, and a
`svelte-vitals.config.ts` that imports `defineConfig` from `svelte-vitals` cannot load without
`node_modules`: the run exits `2` with `Cannot find package 'svelte-vitals'` (reproduced with the
built CLI on a project that has no `node_modules`). Those projects already need an install step
the scaffold does not give them.

## Goal

When the project has `svelte-vitals` installed, the action analyzes and renders with exactly that
installation. The action holds no analyzer code on that path, so there is nothing to keep in step.

## Non-goals

- Fetching a CLI from the registry at run time. It would run code outside both the action's SHA
  pin and the project's lockfile, in a job that holds `pull-requests: write`.
- A version check that only warns. It reports the mismatch and leaves it in place.
- Rendering a JSON report inside the action. `formatGithubReport` and `formatMarkdownReport` take
  `Result[]` and `Config`, not `JsonReport`, and a cross-version report contract would bring the
  skew back in a smaller form.
- Automating the bundled pin bump. Once the bundle is gone (Phase 2) the pin moves only when the
  action itself changes.
- A single-scan mode in the CLI. See "Two runs" below.

## Decisions

1. **The project's CLI comes from the project's installed `node_modules`.** Decided with the
   maintainer. It is the only source that matches the lockfile down to transitive dependencies, it
   stays inside the project's own integrity checks, and the install step is already required for
   `.ts` configs.
2. **The action runs that CLI as a subprocess and uses its reporters.** This reverses decision 2 of
   `2026-07-09-github-action-design.md` ("No `npx`, no subprocess, no second scan pass") for the
   installed path. The contract between the action and the CLI becomes the documented command
   line: flags, reporter names, exit codes. The in-process API (`analyzeProject`, `applyScope`) has
   changed shape across releases and cannot be the contract for "whatever version the project
   has".
3. **The bundled analyzer stays as a fallback in Phase 1, with a visible message, and is removed in
   Phase 2.** Existing workflows have no install step. Removing the bundle first would break all of
   them on their next pin bump.

## Design

### Phase 1: the action (`svelte-vitals-action`, minor release)

#### Resolving the installed CLI

Starting at the `path` input and walking up to the workspace root, look for
`node_modules/svelte-vitals/package.json`. The first hit wins, which is the installation Node would
resolve from that directory (a hoisted monorepo install is found on the way up). Read `version` and
`bin` from it. `require.resolve('svelte-vitals/package.json')` is not usable: the package's
`exports` map exposes only `.`.

The installation is used when its version is at least **0.44.0**. That release is the first whose
`--baseline` analyzes the base ref under the current checkout's config; an older CLI re-loads the
config inside a worktree with no `node_modules` and reports every finding as new.

#### Running it

Two runs of `process.execPath <bin> <absolute path> ...`, with `--diff` and `--baseline` passed
through from the inputs when set:

| Run | Reporter            | stdout                                    | stderr                         | Exit code |
| --- | ------------------- | ----------------------------------------- | ------------------------------ | --------- |
| 1   | `--reporter md`     | captured: job summary and sticky comment  | each line becomes a warning    | the gate  |
| 2   | `--reporter github` | passed through: GitHub parses annotations | passed through to the log only | ignored   |

- `process.execPath` is the action's own Node 24 runtime, so the project's Node setup does not
  matter. Every supported CLI version runs on it.
- The reporter is always explicit. Auto-detection under `GITHUB_ACTIONS` is not relied on.
- The path is passed as an absolute path. The CLI dispatches on its first argument, so a project
  directory named `docs`, `explain`, `install`, `ci` or `complete` would otherwise run that
  subcommand.
- The child does not receive the action's `INPUT_*` variables. The CLI reads none of them, and one
  of them is the token.
- Run 1's exit code decides the step: `0` passes, `1` fails with the existing "found blocking
  issues" message after the summary and comment are written, `2` fails with the CLI's stderr as the
  message and writes no summary or comment. Any other exit, or a spawn failure, fails the step with
  what happened.
- Exit `0` or `1` with an empty stdout is a failed run too. A bin that cannot start makes Node exit
  `1` and print nothing, and the `md` reporter always prints a report, so empty output means the
  CLI never ran. The step fails with the bin's path and stderr; the bundled analyzer is not used in
  its place.
- Today `analysis.warnings` become warning annotations. Run 1's stderr lines keep that behaviour.
  Run 2 repeats the same lines, so its stderr is not annotated.
- Run 2 is skipped when run 1 fails. When run 2 itself cannot start, is killed or exits `2`, one
  warning says the annotations are missing; the gate and the published report are unaffected.

Everything after the markdown exists is unchanged: `core.summary`, the sticky comment with its
marker and fork-PR skip, and the rule that a comment failure only warns.

#### Two runs

The CLI has no way to emit annotations and markdown from one scan. Two runs work with every
released CLI from 0.44.0, which is the point of this design: the fix reaches a project without that
project upgrading anything but the action pin. The cost is a second analysis, and a second baseline
analysis when `baseline` is set. A CLI flag that emits both from one scan can be added later and
used when the installed version has it; it is not part of this design.

#### Fallback to the bundled analyzer

Used when no installation is found or the installed version is below 0.44.0. The existing
in-process path runs, plus one message emitted before the analysis starts, so it is there when the
analysis then fails (a `.ts` config that imports `svelte-vitals`, a rule id the bundled analyzer
does not know):

| Situation                                              | Level   | Message says                                                                                               |
| ------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------- |
| `package.json` declares `svelte-vitals`, not installed | warning | using the bundled X.Y.Z; the project declares `<range>`; install dependencies before this step             |
| Installed, below 0.44.0                                | warning | using the bundled X.Y.Z; installed A.B.C is older than the minimum 0.44.0                                  |
| Not declared, not installed                            | notice  | using the bundled X.Y.Z; add `svelte-vitals` as a devDependency and install it to choose the version in CI |

X.Y.Z is the bundled analyzer's own version, injected at build time from the action's
`node_modules/svelte-vitals/package.json`. The analyzer cannot report it at run time: inside the
bundle it reads the action's `package.json`. The bundled path's report names the same version.

`package.json` is the one in the `path` directory. A declaration through a workspace root or a
catalog that this read misses lands on the notice instead of the warning, which is acceptable for a
message that does not gate.

The action's inputs, outputs (none) and gate semantics do not change, so this is a minor release.

### Phase 1: the scaffold and docs (`svelte-vitals`)

- **`buildWorkflowYaml` gains an install step before the action call.** One rule bounds it: the
  generator never emits a step it can know will fail. A live step is emitted only where the tool it
  needs is known to be there, decided from the lockfile name (`install/package-manager.ts`) and the
  `packageManager` / `devEngines.packageManager` fields of `package.json`:
  - npm with a `package-lock.json`: `npm ci --ignore-scripts`.
  - pnpm with a `pnpm-lock.yaml` and a declared pnpm of 11 or newer: `pnpm/setup` at the SHA this
    repository's own workflows use, held in lockstep by the same kind of test as `CHECKOUT_SHA`
    (`test/ci/lockstep.test.ts`). That action installs pnpm 11 and newer only, and needs the
    version from one of those two fields.
  - Everything else (pnpm 10 or older, pnpm with no declared version, yarn, bun, no lockfile): a
    commented block with the command to enable, and `ci install` prints that the workflow needs it.
    None of these has a setup action this repository already pins and keeps current, and a stale
    third-party pin in generated output is worse than a visible to-do. Such a workflow behaves as
    today's does, and the action's message says what is missing.
- **An install that fails at run time fails the job.** A lockfile out of step with `package.json`,
  an unreachable registry and a private registry without credentials are all outside what the
  generator can know. The step does not carry `continue-on-error`: the action would then analyze
  with the bundled analyzer or a partial install, which is the mismatch this design removes, and a
  lockfile that does not install is a defect the project wants CI to show. The docs say where a
  private registry's credentials go.
- Lifecycle scripts are disabled in the generated install step. The analysis is static and needs no
  built dependency, and the job holds `pull-requests: write`. How to pass that through `pnpm/setup`
  is for the plan to verify against that action's inputs.
- **`ci install` checks that the project declares `svelte-vitals`.** When it does not, it prints
  the command to add it (`pnpm add -D svelte-vitals` and the equivalents). It does not edit
  `package.json`.
- **`ci upgrade` stays a pin rewrite.** It does not insert steps into a workflow the user owns. The
  action's own message is what tells an existing workflow to add the install step, and
  `ci install --force` regenerates the file.
- **Docs** (`guides/(reporting)/ci.md`, en and ja; the action's README): the action runs the
  project's installed `svelte-vitals`; what the generated workflow contains per package manager;
  what the fallback messages mean and how to clear them; the migration for an existing workflow
  (add the install step, or re-run `ci install --force`).

### Phase 2: remove the bundle (`svelte-vitals-action`, major release)

- Delete the in-process path and the `svelte-vitals` / `@svelte-vitals/core` dependencies. The
  three fallback situations become step failures with the same instructions.
- The analyzer-bump procedure in the action repository (its skill, its Renovate rule for the two
  packages, the `dist` rebuild per analyzer release) has nothing left to do.
- In this repository the bundled pin moves only for an action release. `gen-action-pin.js` and the
  Renovate rule stay as they are.

One thing has to be settled before the bundle goes: an install with no
`node_modules/svelte-vitals` directory, such as Yarn Plug'n'Play. Phase 1 does not resolve it and
falls back with the warning. In Phase 2 that would be a failure the user cannot clear by following
the message, so Phase 2 either adds a second way to resolve the CLI or documents those layouts as
unsupported.

When Phase 2 ships is the maintainer's call. Phase 1 is complete without it.

## Guards

- **Action, unit:** the resolver against fixture trees (direct, hoisted, absent, below minimum);
  the runner against a fake bin that exits `0`, `1` and `2` and writes stderr; each fallback
  message.
- **Action, CI:** a fixture SvelteKit project with a pinned older `svelte-vitals` installed, run
  through the built `dist/index.js`. The job asserts the report names the fixture's version and not
  the bundled one, and that the annotation run printed annotations. This is the check that fails if
  resolution silently falls back. A second scenario runs the bundle on a copy of the fixture with no
  install and asserts the message and the report name the bundled analyzer's version.
- **This repository:** workflow tests for each package manager's output, the `pnpm/setup` lockstep
  test, and a `ci install` test for the missing-dependency message.

## Rollout

1. Action Phase 1 release.
2. This repository: scaffold, docs, and the pin bump to that action release, with a changeset.
3. Phase 2 when the maintainer decides.

Existing workflows keep working at every step. Until one gains an install step it analyzes with the
bundled analyzer as it does today, and now says so.

## Calls made here, for review

- Subprocess and CLI reporters, not in-process import of the project's package.
- Two runs now, no new CLI flag.
- Minimum installed version 0.44.0, with fallback below it instead of failure.
- A live install step only for npm with a lockfile and pnpm 11+ with a declared version; a commented
  block for pnpm 10 and older, undeclared pnpm, yarn, bun and no lockfile.
- Lifecycle scripts disabled in the generated install step.
- Yarn Plug'n'Play and similar layouts fall back in Phase 1 and are a precondition of Phase 2.
- `ci install` prints the add-dependency command and does not edit `package.json`.
- `ci upgrade` does not touch workflow steps.
- Phase 2 has no date.
