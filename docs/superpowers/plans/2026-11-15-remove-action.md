# Retire the GitHub Action — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ci install` scaffolds a workflow that runs the project's installed CLI in one step, and that step produces annotations, the job summary and the gate by itself, so the separate action can be retired.

**Architecture:** The CLI's github reporter gains GitHub Actions behaviour (summary append, repository-relative `file=`, analysis warnings as `::warning`), skipped when the retired action is the caller. The scaffold drops the action step for Node setup plus `./node_modules/.bin/svelte-vitals`. `ci upgrade`, the action pin and its Renovate wiring are deleted, and four action-only exports leave core's stable entry.

**Tech Stack:** TypeScript (ESM), gunshi, vitest, oxfmt/oxlint, Blume docs, changesets, Renovate.

**Spec:** `docs/superpowers/specs/2026-11-15-remove-action-design.md`

This plan covers the main-repository PR (spec §1–§6, plus the real-run check). Spec §7 (the action's final release, archive, closing #981) happens after this PR ships, in the action repository, and is not planned here.

## Global Constraints

- Core purity: no `node:` imports, no I/O, no environment reads in `packages/core`.
- The scaffolded step must never fetch the CLI from the registry.
- Node floor `>=24.16.0`; `ubuntu-latest` ships Node 22.23.4, so every scaffold shape sets Node up first.
- Every `uses:` is pinned `@<40-hex-sha> # vX.Y.Z`.
- Exit codes `0`/`1`/`2` keep their meaning; the summary is written before exit.
- The guard matches `GITHUB_ACTION_REPOSITORY === 'oekazuma/svelte-vitals-action'` exactly, and is removed in the 1.0 release.
- English and Japanese docs change together; after editing an English page run `pnpm --filter docs run translate:stamp <en-file...>`.
- Comments say only a non-obvious why; no change history in code or docs.
- Never edit inside `<!-- cli-reference:start/end -->` markers or `skills/` by hand; regenerate.
- Work in a worktree outside `.claude/` (oxfmt/oxlint do not run under `.claude/`). Never `git stash`.

## Review Focus

1. A project analyzed through an auto-picked monorepo app (no path argument, one app found): the prefix must come from the resolved app directory, not the starting directory. Pinned by Task 2's `prefixes from the auto-picked app` test.
2. A finding whose location leaves the project (`../ui/Button.svelte`): it must resolve against the workspace (`apps/ui/Button.svelte`), and stay unchanged only when the result escapes the workspace. Pinned by Task 1's mapper test and Task 2's `sibling package` test.
3. `GITHUB_STEP_SUMMARY` unset or unwritable: the run still prints annotations and returns the gate's exit code. Pinned by Task 2's `summary write failure` test.
4. A warning text containing `%`, CR or LF: the `::warning::` line must stay one workflow command. Pinned by Task 1's escaping test.
5. Base branch names reach the shell only through `env:`, never `${{ }}` inside `run:`. Pinned by Task 3's `no expression in run` test.

## Rulings made while planning

- Run step is `./node_modules/.bin/svelte-vitals` for every shape (spec §3 amended to match): one form, never fetches, fails with exit 127 (distinct from the gate's `1`), and Yarn's supported layout (`nodeLinker: node-modules`) has the same bin. Cost if wrong: one scaffold line per shape.
- Sibling-package paths follow the action's actual `repoRelativeAnnotations` (`posix.join`, unchanged only when the result escapes the workspace); spec §1 amended to match. Cost if wrong: one condition.
- The base ref goes through `env: BASE_REF` because `run:` is shell; the action passed it as an input. Cost if wrong: two YAML lines.
- This repository's own CI sets `GITHUB_ACTIONS`, `GITHUB_WORKSPACE` and `GITHUB_STEP_SUMMARY`, so every new test passes a fully explicit `env` (never a spread of `process.env`), and Task 7 runs the suite with those variables set. Cost if wrong: tests that pass locally and fail, or write into the real job summary, in CI.
- `WORKFLOW_MIN_CLI_VERSION = '0.57.0'` (the minor this PR's changeset produces from 0.56.1); Task 8 rechecks it before the PR is opened.

---

### Task 1: core — mapped locations, warning commands, stable entry

**Files:**

- Modify: `packages/core/src/reporter/github.ts`, `packages/core/src/index.ts`, `packages/core/src/internal.ts`
- Modify: `docs/superpowers/specs/2026-08-16-v1-public-surface.md` (dated entry), `packages/core/README.md` (its package table lists the four names)
- Test: `packages/core/test/github-report.test.ts` (extend)

**Interfaces:**

- Produces: `formatGithubReport(results: Result[], config: Config, opts?: { mapLocation?: (location: string) => string }): string` — `mapLocation` is applied to `r.location` before escaping; omitted means unchanged output.
- Produces: `formatGithubWarning(message: string): string` → `::warning::<escapeData(message)>`, exported from `./internal`.
- `.` no longer exports `formatGithubReport`, `formatMarkdownReport`, `summarize`, `hasFailureAtOrAbove`. `Summary` stays: `JsonReport.summary` references it.

- [ ] **Step 1: Write the failing tests**

```ts
it('applies mapLocation to file= and leaves the title and message alone', () => {
  const out = formatGithubReport([finding({ location: 'src/routes/+page.svelte', line: 3 })], config, {
    mapLocation: (l) => `apps/web/${l}`
  });
  expect(out).toMatch(/^::\w+ file=apps\/web\/src\/routes\/\+page\.svelte,line=3,title=/);
});
it('formatGithubWarning escapes % CR LF so the warning stays one command', () => {
  expect(formatGithubWarning('a%b\r\nc')).toBe('::warning::a%25b%0D%0Ac');
});
```

Plus a test asserting `Object.keys(await import('../src/index.js'))` contains none of the four removed names.

- [ ] **Step 2: Run** `pnpm --filter @svelte-vitals/core test -- github-report` — Expected: FAIL (`mapLocation` ignored, `formatGithubWarning` not exported, removed names still present).
- [ ] **Step 3: Implement** the option and `formatGithubWarning` in `github.ts`; export the latter from `internal.ts`; delete the four exports and their JSDoc block from `index.ts`. Add a dated entry (2026-11-15) to the public-surface spec: the four names return to `./internal` because their only outside consumer, the action, is retired.
- [ ] **Step 4: Run** `pnpm --filter @svelte-vitals/core test && pnpm --filter @svelte-vitals/core typecheck` — Expected: PASS. Then `pnpm build && pnpm typecheck` — Expected: exit 0. Then `git grep -nE "formatGithubReport|formatMarkdownReport|hasFailureAtOrAbove|summarize" -- docs/src README.md 'packages/*/README.md' examples` — Expected: only `packages/core/README.md`, which this task rewrites to drop the four names.
- [ ] **Step 5: Commit** `feat(core)!: move action-only rendering exports back to internal`

### Task 2: CLI — github reporter under GitHub Actions, and the retired-action guard

**Files:**

- Create: `packages/cli/src/github-actions.ts`
- Modify: `packages/cli/src/index.ts` (`RunOptions`, the github branch of `run()`, the comments at the `applyScope` export that name the action)
- Test: `packages/cli/test/github-actions.test.ts` (create)

**Interfaces:**

- Consumes: Task 1's `formatGithubReport(…, { mapLocation })`, `formatGithubWarning`, `formatMarkdownReport`.
- Produces: `RETIRED_ACTION = 'oekazuma/svelte-vitals-action'`; `isRetiredActionCaller(env: NodeJS.ProcessEnv): boolean`; `workspaceLocationMapper(env: NodeJS.ProcessEnv, projectDir: string): ((location: string) => string) | undefined` (undefined when `GITHUB_WORKSPACE` is unset or the project is outside it or at its root).
- Produces: `RunOptions.appendFile?: (path: string, content: string) => void` (default `appendFileSync`).

Behaviour in `run()`, all after analysis:

- If `isRetiredActionCaller(env)`, print once to stderr, with any reporter:
  `svelte-vitals: oekazuma/svelte-vitals-action is retired. Run \`npx svelte-vitals@latest ci install --force\` to switch this workflow to the CLI.` Then the github reporter keeps its old output exactly.
- Otherwise, when `reporter === 'github'` and `env.GITHUB_ACTIONS === 'true'`:
  1. one `formatGithubWarning('svelte-vitals: ' + w)` line on stdout per `analysis.warnings` entry (stderr copies stay);
  2. annotations via `formatGithubReport(results, config, { mapLocation: workspaceLocationMapper(env, resolve(cwd)) })`, where `cwd` is the final (possibly auto-picked) app directory;
  3. if `env.GITHUB_STEP_SUMMARY` is non-empty, append `formatMarkdownReport(results, config, { version }) + '\n'`; on a throw, `errorLog('svelte-vitals: could not write the job summary: <message>')` and carry on.

The mapper reproduces the action's `repoRelativeAnnotations`: `joined = posix.join(prefix, location)`; return `location` unchanged when it is absolute or `joined` is `..` or starts with `../`.

- [ ] **Step 1: Write the failing tests** (drive `run()` on the existing CLI fixtures with injected `log`, `errorLog`, `appendFile` and a fully explicit `env` object, never `{ ...process.env }`):
  - `appends the md report to GITHUB_STEP_SUMMARY` — `appendFile` called once with the summary path and content starting with the md report's first line.
  - `prefixes file= with the project path inside the workspace` — workspace = fixture's parent → every `file=` starts with `<fixture-dir-name>/`.
  - `prefixes from the auto-picked app` — run at a monorepo fixture root with no path; `file=` starts with the app's workspace-relative path.
  - `resolves a sibling package path against the workspace` (unit test on `workspaceLocationMapper`): prefix `apps/web`, `../ui/B.svelte` → `apps/ui/B.svelte`; prefix `web`, `../../x` → unchanged.
  - `emits analysis warnings as ::warning` — a fixture/config that yields an analysis warning produces a `::warning::svelte-vitals: ` line on stdout.
  - `summary write failure keeps the exit code` — `appendFile` throws → stderr line above, exit code equals the run without the throw.
  - `does nothing extra outside GitHub Actions` — `GITHUB_ACTIONS` unset, `--reporter github` → no `appendFile` call, no prefix.
  - `keeps the old output under the retired action` — env adds `GITHUB_ACTION_REPOSITORY=oekazuma/svelte-vitals-action` → stdout equals the no-`GITHUB_ACTIONS` output, no `appendFile`, the retirement line on stderr; with `--reporter md` the retirement line is still printed.
- [ ] **Step 2: Run** `pnpm --filter svelte-vitals test -- github-actions` — Expected: FAIL (module missing). Also `git grep -nE "reporter.*github|'github'" -- packages/cli/test examples/kitchen-sink/test` and give every existing github-reporter run that inherits the environment an explicit `env` without `GITHUB_*`.
- [ ] **Step 3: Implement** `github-actions.ts` and wire it into `run()`.
- [ ] **Step 4: Run** `pnpm build && pnpm --filter svelte-vitals test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(cli): write the job summary and repository-relative annotations under GitHub Actions`

### Task 3: the scaffolded workflow and its Renovate wiring

**Files:**

- Modify: `packages/cli/src/ci/workflow.ts`, `packages/cli/src/ci/install-step.ts` (only `installStepNote` wording), `renovate.json`, and the two `buildWorkflowYaml` call sites (`packages/cli/src/gunshi/ci.ts`, `packages/cli/src/install/index.ts`) reduced to `{ installStep }`
- Modify: the "Writing it by hand" YAML blocks of `docs/src/content/docs/guides/(reporting)/ci.md` and `docs/src/content/docs/ja/guides/(reporting)/ci.md` (the rest of those pages is Task 6)
- Test: `packages/cli/test/ci/workflow.test.ts`, `packages/cli/test/ci/guide.test.ts`, `packages/cli/test/ci/install-step.test.ts`

**Interfaces:**

- Produces: `SETUP_NODE_SHA = '949feb2413d6458794dcd2491c4babbbce0c15c1'`, `SETUP_NODE_VERSION = 'v7.1.0'` (latest `actions/setup-node` release, published 2026-10-08).
- Produces: `buildWorkflowYaml(opts: { installStep: InstallStepPlan; appPath?: string }): string`. `appPath` (POSIX, relative to the repository root) becomes the first argument of the run step.

Exact npm output (pnpm and manual differ only between checkout and the run step):

```yaml
# Generated by svelte-vitals (`ci install` or `install --client ci-workflow`).
# Re-run with --force to regenerate.
name: svelte-vitals

on:
  pull_request:

permissions:
  contents: read

jobs:
  svelte-vitals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<CHECKOUT_SHA> # <CHECKOUT_VERSION>
        with:
          fetch-depth: 0
          persist-credentials: false
      - uses: actions/setup-node@<SETUP_NODE_SHA> # <SETUP_NODE_VERSION>
        with:
          node-version: 24
      - run: npm ci --ignore-scripts
      - run: ./node_modules/.bin/svelte-vitals --reporter github --diff "origin/$BASE_REF" --baseline "origin/$BASE_REF"
        env:
          BASE_REF: ${{ github.base_ref }}
```

- pnpm: `pnpm/setup@<sha> # <version>` with `install: false` and `runtime: node`, then `- run: pnpm install --frozen-lockfile --ignore-scripts`.
- manual: two comment lines, then the commented command:
  `# Set up Node.js 24.16.0 or newer and your package manager, then install dependencies.`
  `# Without an install the next step fails: it runs the svelte-vitals in node_modules.`
  `# - run: <plan.command>`

`renovate.json`: delete the `action-pin.generated.ts` manager and the `oekazuma/svelte-vitals-action` package rule; add a `workflow.ts` manager for `SETUP_NODE_SHA`/`SETUP_NODE_VERSION` (`depNameTemplate: actions/setup-node`, same shape as the checkout one); add `actions/setup-node` to the CI-guide manager's `depName` alternation and to the no-automerge rule's `matchDepNames`.

- [ ] **Step 1: Write the failing tests** in `workflow.test.ts`, replacing the action-specific ones:
  - `contains no reference to the retired action` — no `svelte-vitals-action`, no `pull-requests: write`.
  - `pins actions/setup-node with a same-line version comment` (npm shape) and `pnpm shape sets runtime: node`.
  - `runs the installed bin, never a registry fetch` — contains `./node_modules/.bin/svelte-vitals --reporter github`; no `npx`, `pnpm exec`, `dlx`.
  - `no expression in run` — every line starting with `- run:` is free of `${{`.
  - `passes appPath as the first argument` — `appPath: 'apps/web'` → `svelte-vitals apps/web --reporter github`.
  - `manual shape keeps install commented and the run step live`.
  - `guide.test.ts`: call `buildWorkflowYaml({ installStep: { kind } })` with the real pins (no placeholder SHA argument any more).
- [ ] **Step 2: Run** `pnpm --filter svelte-vitals test -- test/ci` — Expected: FAIL.
- [ ] **Step 3: Implement** `workflow.ts`, update the guide's "Writing it by hand" blocks (en and ja) to the generator's npm and pnpm output, and edit `renovate.json`. Validate the JSON with `node -e "JSON.parse(require('fs').readFileSync('renovate.json','utf8'))"`.
- [ ] **Step 4: Run** `pnpm --filter svelte-vitals typecheck && pnpm --filter svelte-vitals test -- test/ci` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(cli): scaffold a workflow that runs the installed CLI instead of the action`

### Task 4: `ci` command — remove `ci upgrade` and the pin, add migration notes

**Files:**

- Delete: `packages/cli/src/ci/upgrade.ts`, `packages/cli/src/ci/action-pin.generated.ts`, `packages/cli/scripts/gen-action-pin.js`, `packages/cli/scripts/resolve-action-pin.js`, `packages/cli/test/ci/upgrade.test.ts`, `packages/cli/test/gen-action-pin.test.ts`
- Modify: `packages/cli/package.json` (drop `update-action-pin`), `packages/cli/src/gunshi/ci.ts`, `packages/cli/src/gunshi/complete.ts`, `packages/cli/src/gunshi/analyze.ts` (help line), `packages/cli/src/gunshi/locales/ja.ts`, `packages/cli/src/install/index.ts`, `packages/cli/src/install/targets.ts` (ci-workflow hint)
- Test: `packages/cli/test/ci/cli.test.ts`, `packages/cli/test/install/run.test.ts`, help/completion snapshots (`pnpm --filter svelte-vitals test -- -u` only after reading each diff)

**Interfaces:**

- Consumes: Task 3's `buildWorkflowYaml({ installStep, appPath })`.
- Produces: `WORKFLOW_MIN_CLI_VERSION = '0.57.0'` and `workflowNotes(io, existing: string | undefined): string[]` in `packages/cli/src/ci/notes.ts` (create), used by both `ci install` and `install --client ci-workflow`.

Notes `workflowNotes` returns, in this order:

1. Existing file mentions `oekazuma/svelte-vitals-action` and is not being overwritten: `! .github/workflows/svelte-vitals.yml still calls oekazuma/svelte-vitals-action, which is retired. Re-run with --force to replace it with the CLI step.`
2. Workspace root (`workspaces` in `package.json` or `pnpm-workspace.yaml`), no `appPath`, and the root `package.json` does not declare `svelte-vitals` (the root-declared layout the setup skill recommends needs no note): `! This is a workspace root. The svelte-vitals step runs ./node_modules/.bin/svelte-vitals here; if svelte-vitals is declared in an app instead, add working-directory: <app> to that step.`
3. `node_modules/svelte-vitals/package.json` version below `WORKFLOW_MIN_CLI_VERSION` (prerelease suffix ignored, as the action's `isAtLeast`): `! node_modules has svelte-vitals <v>. The workflow needs ${WORKFLOW_MIN_CLI_VERSION} or newer for the job summary and repository-relative annotations; update the devDependency.`

The existing install-step note and the "not in package.json" note stay.

- [ ] **Step 1: Write the failing tests** in `cli.test.ts`: `ci upgrade exits 2 with the usage error`; one test per note above (positive and the case where it must not print); `install --app apps/web --client ci-workflow writes the app path into the run step` in `run.test.ts`.
- [ ] **Step 2: Run** `pnpm --filter svelte-vitals test -- test/ci test/install` — Expected: FAIL.
- [ ] **Step 3: Implement**: delete the files, remove the upgrade subcommand and `CI_UPGRADE_ARGS` from `gunshi/ci.ts` and `complete.ts`, rewrite the `ci` help text (en and ja) to mention only `ci install`, add `notes.ts`, pass `appPath = relative(io.cwd, appDir)` (POSIX, omitted when empty) from `install`.
- [ ] **Step 4: Run** `pnpm build && pnpm --filter svelte-vitals test` — Expected: PASS after reviewing and accepting snapshot diffs that only drop `ci upgrade` / the action wording. Then `git grep -nE "svelte-vitals-action|@svelte-vitals/action|ACTION_SHA|ci upgrade" -- packages/cli/src packages/cli/scripts packages/cli/package.json` — Expected: only `RETIRED_ACTION` and the notes text.
- [ ] **Step 5: Commit** `feat(cli)!: remove ci upgrade and the action pin`

### Task 5: kitchen-sink e2e

**Files:**

- Test: `examples/kitchen-sink/test/e2e-github-actions.test.ts` (create; follow `e2e-static.test.ts`'s use of the built CLI)

- [ ] **Step 1: Write the tests** running the built CLI on the gallery with a fully explicit env (`PATH` plus `GITHUB_ACTIONS=true`, `GITHUB_WORKSPACE=<repo root>`, `GITHUB_STEP_SUMMARY=<temp file>`) and `--reporter github`; the "plain run" it compares against gets `PATH` only:
  - the summary file contains the md report's header row;
  - every `file=` on stdout starts with `examples/kitchen-sink/`;
  - the exit code equals the plain `--reporter github` run's;
  - with `GITHUB_ACTION_REPOSITORY=oekazuma/svelte-vitals-action` the summary file stays empty, no `file=` has the prefix, and stderr has the retirement line.
- [ ] **Step 2: Run** `pnpm build && pnpm --filter kitchen-sink test -- e2e-github-actions` — Expected: PASS. Then comment out the summary append and the `mapLocation` argument in `packages/cli/src/github-actions.ts`/`index.ts`, rebuild, re-run — Expected: FAIL on the first two assertions. Restore and rebuild.
- [ ] **Step 3: Commit** `test(kitchen-sink): pin the GitHub Actions summary and annotation paths`

### Task 6: docs, generated files, changesets

**Files:**

- Modify: `docs/src/content/docs/guides/(reporting)/ci.md`, its `ja/` twin; `docs/src/content/docs/guides/(getting-started)/choosing-a-package.md`, its `ja/` twin; `packages/cli/docs/ci.md`; `README.md`; `packages/cli/README.md`; `CONTRIBUTING.md`; `AGENTS.md`
- Regenerate: `packages/cli/src/docs/generated.ts` (`gen:docs`), the CLI-reference tables (`gen:cli-reference`), `skills/` (`gen:skills`, if its output changes)
- Create: `.changeset/retire-action-cli.md` (`svelte-vitals: minor`), `.changeset/retire-action-core.md` (`@svelte-vitals/core: minor`)

Content to land (the snapshot of current behaviour, no history):

- CI guide: what the scaffolded workflow does (annotations, job summary, gate; no PR comment), the three install shapes, the Node requirement, monorepo (`working-directory:` or `install --app`), migrating from the action (`ci install --force`; until then the CLI keeps the old output and prints the retirement line), Yarn PnP unsupported (`nodeLinker: node-modules`). Remove inputs, `github-token`, sticky comment, fork-comment text and `ci upgrade`.
- `AGENTS.md`: delete the action/`gen-action-pin`/Renovate paragraph in the package map; describe core's `.` entry as config authoring and reading a JSON report; extend "Setup-action pins move in lockstep" with `actions/setup-node` (kept fresh by its Renovate manager; this repository's workflows do not use it, so no lockstep test).
- Changeset (cli): the scaffold no longer uses the action and drops `pull-requests: write` and the PR comment; the github reporter under GitHub Actions also writes the job summary, repository-relative paths and `::warning` lines; `ci upgrade` is removed (re-run `ci install --force`); workflows still on the action keep their output until 1.0 and print a retirement line.
- Changeset (core): the four names removed from `.` (import from `@svelte-vitals/core/internal`, which carries no semver guarantee).

- [ ] **Step 1: Edit** the pages and files above.
- [ ] **Step 2: Run** `pnpm --filter svelte-vitals run gen:docs && pnpm --filter svelte-vitals run gen:cli-reference && pnpm --filter svelte-vitals run gen:skills && pnpm format` — Expected: exit 0.
- [ ] **Step 3: Run** `pnpm --filter docs run translate:stamp <en-file...>` for the CI guide and `choosing-a-package` pages, after both Japanese pages are updated (read `docs/scripts/stamp-translation.js` for the path form it expects) — Expected: exit 0.
- [ ] **Step 4: Run** `git grep -nE "svelte-vitals-action|@svelte-vitals/action|ci upgrade|sticky" -- . ':!plans' ':!docs/superpowers' ':!**/CHANGELOG.md' ':!.changeset'` — Expected: only `RETIRED_ACTION`, the notes text, the migration section of the CI guide (en/ja) and tests.
- [ ] **Step 5: Commit** `docs: describe the CLI workflow and retire the action`

### Task 7: full verification

- [ ] **Step 1: Run** each and record the exit code: `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm check:publish`, `pnpm smoke`, `pnpm --filter docs exec blume translate --check` (or the docs job's exact command from `.github/workflows/ci.yml`) — Expected: all exit 0.
- [ ] **Step 2: Run** `GITHUB_ACTIONS=true GITHUB_WORKSPACE="$PWD" GITHUB_STEP_SUMMARY="$(mktemp)" pnpm test`, then check that summary file is still empty — Expected: exit 0 and an empty file (no test leaks into a real job summary).
- [ ] **Step 3:** Detection is unchanged, so no corpus re-measurement; the PR's corpus job must report an empty finding diff. Note this in the PR body as "to be confirmed by the corpus job", not as run.

### Task 8: real GitHub runs (needs the owner's OK to create the repository)

- [ ] **Step 1:** Ask the owner for OK to create a private throwaway repository (they delete it afterwards). Do not create it before that.
- [ ] **Step 2:** `pnpm pack` the built `svelte-vitals` and `@svelte-vitals/core`. The packed CLI names `@svelte-vitals/core` by plain version, so each fixture adds an override pointing it at the core tarball (`overrides` for npm, `pnpm.overrides` for pnpm); check the installed `node_modules/@svelte-vitals/core` is the tarball before trusting a run.
- [ ] **Step 3:** Run the old-action fixture first (a workflow on `oekazuma/svelte-vitals-action@<v0.15.3 sha>` with the new CLI installed). It is the only measurement that `GITHUB_ACTION_REPOSITORY` reaches the CLI with that exact value; if it does not, stop and bring it to the owner, because the guard's design depends on it.
- [ ] **Step 4:** Then the other fixtures: npm at the root; pnpm at the root; a pnpm workspace with the app in `apps/web` and the CLI declared at the root; the same workspace with the CLI declared only in `apps/web` and `working-directory: apps/web` on the step. Open one PR per fixture with a planted finding and check: annotations on the diff, the summary table, the gate result, the subdirectory paths, and a failing step (exit 127) when the install step is removed.
- [ ] **Step 5:** Recheck `WORKFLOW_MIN_CLI_VERSION` against the version the Version Packages PR would produce from the pending changesets; fix it if another minor has shipped.
- [ ] **Step 6:** Record what was run, with run URLs, for the PR body. Ask the owner before pushing the branch or opening the PR.
