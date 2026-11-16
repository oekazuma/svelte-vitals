# Retire the GitHub Action: the scaffolded workflow runs the CLI

**Date:** 2026-11-15
**Status:** Approved (owner, 2026-11-15)
**Repositories:** `oekazuma/svelte-vitals` (CLI, core, scaffold, docs), `oekazuma/svelte-vitals-action` (final release, then archived)
**Supersedes:** the Phase 2 plan in `2026-11-11-action-runs-project-cli-design.md` (issue #981)

## Intent

svelte-vitals is heading to 1.0 as a guardrail that keeps AI agents (and people) on SvelteKit best
practice: a linter, not a score dashboard. A separately released GitHub Action is not part of that
product, and it costs more than it returns:

- Every CLI release triggers a chain: rebuild the action's bundle, release the action, bump the
  pin the CLI scaffolds, release the CLI again (the 0.56.0 → 0.56.1 cycle on 2026-11-14 is the
  worked example).
- Its own repository, Renovate configuration and release pipeline.
- `@svelte-vitals/core`'s semver-stable entry carries four rendering and gating exports that exist
  only because the action imports them, and 1.0 would freeze them.
- The version skew the bundled analyzer causes needs a further major release of the action
  (#981) to remove.

Since action v0.15.0 the action already runs the project's installed CLI and only falls back to the
bundled one. What the action adds on top of the CLI is small (measured against its `src/` at
v0.15.3):

| Action behaviour                                          | After this change                                   |
| --------------------------------------------------------- | --------------------------------------------------- |
| Annotations (`--reporter github`)                         | CLI, unchanged                                      |
| Job summary (`--reporter md` written to the step summary) | CLI writes it itself (§1)                           |
| Annotation paths rewritten to repository-relative         | CLI writes them that way itself (§1)                |
| CLI stderr turned into warning annotations                | CLI emits its analysis warnings as `::warning` (§1) |
| Sticky PR comment, skipped on fork PRs                    | Dropped (owner's decision)                          |
| Bundled analyzer fallback                                 | Dropped; the step fails if the CLI is not installed |

## Goals

- `ci install` scaffolds a workflow with no `oekazuma/svelte-vitals-action` step: checkout, Node
  setup, dependency install, one `run:` step that executes the project's installed CLI.
- That one step produces annotations, the job summary and the pass/fail gate from a single
  analysis.
- Workflows still pinned to the action keep producing the same output when the project upgrades its
  CLI (§2).
- No release of svelte-vitals needs an action release, and nothing in this repository tracks an
  action version.
- The four action-only exports leave `@svelte-vitals/core`'s stable entry before 1.0.

## Non-goals

- A PR comment in any form. The owner chose annotations plus the job summary; a comment would bring
  back token handling (`pull-requests: write`) and either GitHub API code in the CLI or
  consumer-owned script in the YAML, which is what issue #154 replaced.
- Support for CI systems other than GitHub Actions beyond what the CLI already does.
- Renaming the project (a separate, later decision).

## Anti-goals

- **The scaffolded step must never fetch the CLI from the registry.** Plain `npx svelte-vitals` does
  exactly that in CI: with `CI=true` and no TTY, npm assumes `--yes` and runs the latest published
  version (measured 2026-11-15 in an empty directory: npx printed `npm notice run 'svelte-vitals'`
  and ran 0.56.1). Fetching at run time was already rejected for supply-chain reasons. The step
  must run the installed copy and fail when there is none (`npx --no svelte-vitals` refuses with
  `npx canceled due to missing packages`, exit 1).
- **No silent degradation.** A run that cannot analyze must fail the step, and a run that analyzed
  with dropped rules must say so in a place a reader of a passing job sees.

## Constraints

- **Node floor.** The CLI requires Node `>=24.16.0`. The `ubuntu-latest` (24.04) runner image ships
  Node 22.23.4 (runner-images `Ubuntu2404-Readme.md`, read 2026-11-15), so the workflow must install
  Node before the CLI runs. The action never needed this: it spawned the CLI with the runner's own
  `node24`.
- **Core purity.** The reporters in `packages/core` stay free of I/O and environment reads. The CLI
  reads `GITHUB_WORKSPACE`/`GITHUB_STEP_SUMMARY` and passes values in.
- **Pinned actions.** Every `uses:` in the scaffold is pinned to a commit SHA with a same-line
  `# vX.Y.Z` comment, and each pin is kept fresh by a Renovate regex manager (`renovate.json`) and
  checked against the CI guide (`packages/cli/test/ci/guide.test.ts`).
- **Exit codes.** `0`/`1`/`2` keep their meaning. The summary is written before the process exits
  with `1`.

## Approaches considered

1. **The CLI writes the job summary itself (chosen).** Under GitHub Actions the github reporter also
   appends the Markdown report to `$GITHUB_STEP_SUMMARY` and writes repository-relative paths. One
   analysis, one `run:` line, and the step's exit code is the gate. The cost is a file write
   triggered by the environment rather than a flag; vitest's GitHub Actions reporter does the same.
2. **Two `run:` steps in the YAML** (`--reporter github`, then `--reporter md >> "$GITHUB_STEP_SUMMARY"`
   with `if: always()`). Almost no CLI change, but two analyses double the job time and the YAML
   grows back toward what #154 complained about.
3. **Annotations only.** Shortest, but nothing gives an overview of all findings.

The owner picked approach 1 on 2026-11-15.

## Design

### 1. CLI: the github reporter under GitHub Actions

When the resolved reporter is `github` (explicit or auto-selected) and the run is not inside the
retired action (§2):

- **Job summary.** If `GITHUB_STEP_SUMMARY` names a file, append the output of
  `formatMarkdownReport` for the same results to it, then print the annotations. A write failure is
  a warning on stderr, not an exit `2`: the gate and the annotations still stand.
- **Repository-relative paths.** If `GITHUB_WORKSPACE` is set and the analyzed project directory is
  inside it, `file=` values are prefixed with the project's path relative to the workspace. A
  project at the workspace root gets no prefix. As in the action's `repoRelativeAnnotations`, a
  location is joined to the prefix POSIX-style, so a sibling package reported as `../ui/B.svelte`
  from `apps/web` becomes `apps/ui/B.svelte`; it is left unchanged only when it is absolute or the
  join escapes the workspace. `formatGithubReport` takes a location mapper as an option; the CLI
  builds it.
- **Analysis warnings.** Each entry of `analysis.warnings` (crashed rules, config warnings) is also
  emitted as a `::warning::` workflow command, so it shows on a passing job. Other stderr lines
  (hints such as "github reporter auto-selected") stay plain stderr.

`formatMarkdownReport` keeps its 50-row cap. Nothing changes for `--reporter github` outside GitHub
Actions.

### 2. Compatibility with workflows still on the action

A JS action's child processes inherit `GITHUB_ACTION_REPOSITORY`, and the action strips only
`INPUT_*` from the environment it passes to the CLI. Without a guard, a project that upgrades its CLI
while its workflow is still pinned to the action gets two summary tables (the CLI's and the
action's) and, when the action's `path` input is a subdirectory, a doubled path prefix
(`apps/web/apps/web/...`), so annotations no longer attach to the diff.

**Decision (owner, 2026-11-15): guard it.** When `GITHUB_ACTION_REPOSITORY` is
`oekazuma/svelte-vitals-action`, the CLI keeps the old github reporter output (no summary write, no
prefix, no extra `::warning`). With any reporter it also prints one stderr line saying the action is
retired and naming the migration (`svelte-vitals ci install --force`): the action turns the stderr of
its first run (`--reporter md`) into warning annotations, so that is where the line becomes visible.
The guard is not part of the 1.0 contract and is removed in the 1.0 release itself, so old-action
users get the rest of 0.x to migrate.

The rejected alternative was no guard, with the breakage stated in the changeset.

### 3. The scaffolded workflow

`buildWorkflowYaml` loses `actionSha`/`actionVersion`. The workflow:

- `permissions: contents: read` only. `pull-requests: write` goes away with the comment.
- `actions/checkout` as today (`fetch-depth: 0`, `persist-credentials: false`).
- Node and install, per `planInstallStep` shape:
  - The npm shape gets `actions/setup-node` (new pin, Node 24 or later), then
    `npm ci --ignore-scripts`.
  - The pnpm 11+ shape gets `pnpm/setup` with `install: false` and `runtime: node` (installs the
    version in `devEngines.runtime`, else Node LTS), then
    `pnpm install --frozen-lockfile --ignore-scripts`.
  - The manual shape (Yarn, Bun, pnpm below 11, no lockfile) keeps the setup and install lines
    commented out, as today, and `ci install` keeps printing why. The run step is live, so the
    first run fails loudly until the user fills them in; there is no fallback any more. Yarn
    Plug'n'Play stays unsupported, as the CI guide says today (`nodeLinker: node-modules`).
    (Author's call.)
- The run step executes `./node_modules/.bin/svelte-vitals` with `--reporter github`, `--diff` and
  `--baseline` at `origin/$BASE_REF`, the base ref passed through `env:` rather than a `${{ }}`
  expression inside the shell line. One form for every shape: it never fetches, a missing install
  fails with exit 127 rather than the gate's `1`, and Yarn's supported layout has the same bin.
  (Author's call, refined while planning.)

**Recurring cost, stated:** the npm shape adds a third pinned action. Each `actions/setup-node`
release becomes a Renovate PR that needs a human changeset and a re-stamp of the English CI guide,
as checkout and `pnpm/setup` bumps do today. That replaces the per-CLI-release action cycle, which
is larger and more frequent.

### 4. `ci install` on an existing workflow, and `ci upgrade`

- `ci upgrade` does not exist. Running it fails with the standard unknown-subcommand usage error
  (exit `2`).
- Without `--force`, an existing `.github/workflows/svelte-vitals.yml` is left alone. When it
  references `oekazuma/svelte-vitals-action@` or the older `oekazuma/svelte-vitals/packages/action@`,
  a note says the action is retired and tells the user to re-run with `--force`.
- The run step stays at the repository root. In a monorepo the CLI may be declared at the workspace
  root or in the app. `--app <dir>`
  (`install --client ci-workflow`) names the app and an app that `install` resolves on its own for
  the Vite and config targets in the same run is used the same way: either way its path, relative
  to the current directory, is the positional argument of the step. Otherwise the CLI's own app
  resolution applies (one app is analyzed, several exit `2` naming them, per the monorepo topic).
  §1 computes the prefix from the resolved app directory, so annotations land either way.
  `--app` pointing at a directory that is not a SvelteKit app exits `2`, also when `ci-workflow` is
  the only target. `ci install` itself takes no `--app`.
- Three notes describe the generated step, so they print only when the workflow is written
  (or, under `--dry-run`, would be), by `ci install` and `install --client ci-workflow` alike:
  - When the current directory has a `package.json` that does not declare `svelte-vitals` and is not
    a workspace root, a note gives the command that adds it: the step runs
    `./node_modules/.bin/svelte-vitals`, so without it the step fails.
  - When the current directory is a workspace root (`workspaces` in `package.json` or a
    `pnpm-workspace.yaml`) whose `package.json` does not declare `svelte-vitals`, a note says the step
    runs `./node_modules/.bin/svelte-vitals` there. When the CLI is declared only in the app and the
    package manager puts no bin at the root, the user adds `working-directory:` to the step; with an
    app path the note names that directory and says to drop the path argument. (Author's call.)
  - When `node_modules/svelte-vitals` is installed below `WORKFLOW_MIN_CLI_VERSION` (the first
    release that ships §1), a note names the installed version: an older CLI runs the step but writes
    no summary and no prefix, which would otherwise go unnoticed. Only the release part of the
    version is compared; a prerelease or build suffix is ignored. (Author's call.)

### 5. Removals in this repository

- `packages/cli/src/ci/action-pin.generated.ts`, `scripts/gen-action-pin.js`,
  `scripts/resolve-action-pin.js`, the `update-action-pin` script, `src/ci/upgrade.ts` and their
  tests.
- `renovate.json`: the action's regex manager and package rule. Add a manager for the
  `actions/setup-node` constants and add it to the CI-guide manager and the no-automerge rule.
- Every `@svelte-vitals/action` / `svelte-vitals-action` mention outside history documents
  (`plans/`, `docs/superpowers/`, `CHANGELOG.md`): help text (en/ja locales), `packages/cli/docs/ci.md`,
  the CI guide and `choosing-a-package` page (en/ja), READMEs, `CONTRIBUTING.md`, `AGENTS.md`
  (package map, the core `.` entry description, the lockstep convention), help snapshots. Then
  `gen:docs`, `gen:cli-reference`, `gen:skills` if their output changes, and `pnpm format`.

### 6. `@svelte-vitals/core` stable entry

Move `formatGithubReport`, `formatMarkdownReport`, `summarize` and `hasFailureAtOrAbove` from `.`
back to `./internal` (no package in this repository imports them from `.`). `.` stays type-closed;
`Summary` stays only if a remaining `.` export references it. A dated entry in
`2026-08-16-v1-public-surface.md` records the reversal. This is a breaking change to a pre-1.0
package: a minor changeset for `@svelte-vitals/core`.

### 7. The action repository

After the CLI release that ships §1–§6:

1. A final action release: README opens with the retirement notice and the migration
   (`npx svelte-vitals@latest ci install --force`), and the action prints one warning at the start of
   every run saying the same. Renovate's PR for that release is the notice existing users see. The
   release stays on its 0.56.x dependencies (it imports the exports §6 moves), and Renovate is
   turned off in that repository before it is archived. (Author's call.)
2. The owner archives the repository (pinned SHAs keep resolving) and decides on the Marketplace
   listing.
3. #981 is closed as superseded, linking this document.

## Testing and done criteria

- Unit tests for §1 (summary appended, prefix applied, warnings emitted, nothing of this outside
  GitHub Actions, the §2 guard), §3 (each install shape) and §4.
- A kitchen-sink e2e case that sets `GITHUB_ACTIONS`, `GITHUB_WORKSPACE` and `GITHUB_STEP_SUMMARY`
  and asserts the summary file gets the table and `file=` carries the prefix.
- The existing verify commands (`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm check:publish`).
  Detection does not change, so the corpus diff must be empty.
- **Real GitHub runs** in a throwaway private repository (created only with the owner's OK; the owner
  deletes it): npm at the root, pnpm at the root, a pnpm workspace with the app in a subdirectory,
  and a workflow still pinned to action v0.15.3 running the new CLI. Each run is checked for
  annotations on the diff, the summary table, the gate result, and a failing step when the install
  step is removed.

## Left to the builder

- The exact run-step command per install shape, within the anti-goal above.
- The `actions/setup-node` version spec, as long as it resolves to `>=24.16.0`.
- Wording of the new messages, following the existing message style.
- How the unreleased CLI reaches the throwaway repository for the real runs (packed tarballs, not a
  prerelease).
- Whether the §1 summary write goes through the existing `writeFile` injection or a new append hook.
