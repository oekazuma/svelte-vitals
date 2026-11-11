# Action runs the project's CLI (Phase 1, action repository) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the analyzed project has `svelte-vitals` installed, the action runs that installation's CLI and publishes its output; otherwise it analyzes with the bundled analyzer as today and says so.

**Architecture:** A resolver finds `node_modules/svelte-vitals` from the analyzed directory upward. `main()` branches on the result: the installed path spawns the CLI twice (`--reporter md` captured, `--reporter github` passed through) and gates on the first run's exit code; the fallback path is today's in-process code plus one message. Summary and sticky-comment publishing is shared by both paths.

**Tech Stack:** TypeScript (ESM), `@actions/core`, `@actions/github`, `node:child_process`, vitest, tsup. Repository: `oekazuma/svelte-vitals-action`, branch `claude/run-project-cli`.

**Spec:** `docs/superpowers/specs/2026-11-11-action-runs-project-cli-design.md` in `oekazuma/svelte-vitals` (the "Phase 1: the action" section and "Guards").

## Global Constraints

- Minimum installed version: `0.44.0`. Below it, fall back to the bundled analyzer.
- The CLI is run as `process.execPath <bin> <path> --reporter <md|github> [--diff <ref>] [--baseline <ref>]`. The reporter is always explicit.
- Run 1 (`md`) exit code: `0` pass, `1` fail after publishing, `2` fail with stderr as the message and publish nothing. Run 2 (`github`) is skipped when run 1 exits `2` or fails to spawn; its exit code is ignored.
- Run 1's non-empty stderr lines become `core.warning` when it exits `0` or `1`. Run 2's stderr is not annotated.
- `action.yml` does not change. No new input, no output.
- No new runtime dependency. Version comparison is a few lines, not a semver package.
- Tests use real temp directories and a real subprocess (a fake bin script). Do not mock `node:fs` or `node:child_process`.
- `dist/index.js` is committed and must match the source (`pnpm build`). A user-facing change needs a changeset.
- Comments say only what the code cannot. No change history in comments or docs.
- Verify with `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, judged by exit code.

## Review Focus

1. **A monorepo where `path` is a subdirectory and the install is hoisted to the root.** The resolver must find the root's `node_modules/svelte-vitals` and still pass the subdirectory as the CLI's path.
2. **The CLI exits `1` with a full report.** The summary and the comment must be written before `setFailed`.
3. **The CLI exits `2`.** Nothing is published, run 2 does not start, and the failure message is the CLI's stderr, not a generic line.
4. **Large output.** A markdown report can be megabytes; capture must not truncate or deadlock on a full pipe.
5. **The bin cannot start** (missing file, not executable JavaScript). The step fails with what happened; it does not fall back silently, because the project asked for that version.

---

### Task 1: Resolve the installed CLI

**Files:**

- Create: `src/resolve-cli.ts`
- Test: `test/resolve-cli.test.ts`

**Interfaces:**

- Produces:

  ```ts
  export const MIN_CLI_VERSION = '0.44.0';

  export type CliResolution =
    | { kind: 'installed'; version: string; bin: string } // bin is an absolute path
    | { kind: 'too-old'; version: string }
    | { kind: 'missing'; declared?: string }; // declared = the range in <projectDir>/package.json

  /** Walks from projectDir up to and including stopDir; the first node_modules/svelte-vitals wins. */
  export function resolveProjectCli(projectDir: string, stopDir: string): CliResolution;
  ```

- [ ] **Step 1: Write the failing tests** in `test/resolve-cli.test.ts`. Each builds a tree under `mkdtempSync` and removes it afterwards. A helper writes `node_modules/svelte-vitals/package.json` with a given `version` and `bin`.

  ```ts
  it('finds an install in the project directory', ...)
  // { name, version: '0.55.5', bin: { 'svelte-vitals': './dist/bin.js' } }
  // → { kind: 'installed', version: '0.55.5', bin: join(root, 'node_modules/svelte-vitals/dist/bin.js') }

  it('finds an install hoisted above the project directory', ...)
  // install at root, projectDir = root/apps/web, stopDir = root → installed, bin under root

  it('prefers the nearest install', ...)
  // 0.50.0 at root/apps/web, 0.55.5 at root → version '0.50.0'

  it('does not look above stopDir', ...)
  // install at root, projectDir = root/ws/app, stopDir = root/ws → { kind: 'missing' }

  it('accepts a string bin field', ...)
  // bin: './dist/bin.js'

  it.each(['0.44.0', '0.44.1', '0.100.0', '1.0.0', '0.44.0-next.1'])('accepts %s', ...)
  it.each(['0.43.9', '0.9.0', '0.20.0'])('reports %s as too old', ...)
  // → { kind: 'too-old', version }

  it('reports the declared range when the package is not installed', ...)
  // <projectDir>/package.json devDependencies: { 'svelte-vitals': '^0.55.0' }
  // → { kind: 'missing', declared: '^0.55.0' }  (also covers `dependencies`)

  it('reports missing with no declaration', ...)
  // → { kind: 'missing' } and `'declared' in result` is false or undefined

  it('treats an unreadable or bin-less package.json as missing', ...)
  // node_modules/svelte-vitals/package.json = '{' ; and one with no bin
  ```

- [ ] **Step 2: Run them and watch them fail**

  Run: `pnpm exec vitest run test/resolve-cli.test.ts`
  Expected: FAIL, cannot resolve `../src/resolve-cli.js`.

- [ ] **Step 3: Implement `src/resolve-cli.ts`.** Compare versions on the numeric `major.minor.patch` only (a prerelease suffix is ignored). `'0.100.0' >= '0.44.0'` must hold, so compare as numbers, not strings. An install whose `package.json` cannot be parsed or has no `svelte-vitals` bin does not stop the walk: continue upward. The walk also ends at the filesystem root, for a `projectDir` that is not under `stopDir`.

- [ ] **Step 4: Run the tests**

  Run: `pnpm exec vitest run test/resolve-cli.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/resolve-cli.ts test/resolve-cli.test.ts
  git commit -m "feat: resolve the svelte-vitals installed in the analyzed project"
  ```

### Task 2: Run the CLI

**Files:**

- Create: `src/run-cli.ts`
- Create: `test/fixtures/fake-cli.mjs`
- Test: `test/run-cli.test.ts`

**Interfaces:**

- Produces:

  ```ts
  export interface CliOptions {
    path: string;
    diff?: string;
    baseline?: string;
  }

  export function cliArgs(reporter: 'md' | 'github', opts: CliOptions): string[];
  // ['<path>', '--reporter', '<reporter>', ...('--diff', ref), ...('--baseline', ref)]

  export interface CliRun {
    /** null when the process did not exit normally (spawn failure or signal). */
    code: number | null;
    stdout: string; // '' when stdout was inherited
    stderr: string; // '' when stderr was inherited
    /** Set when the process could not be started or was killed by a signal. */
    failure?: string;
  }

  /** capture: pipe both streams and return them. inherit: hand both to this process. */
  export function runCli(bin: string, args: string[], mode: 'capture' | 'inherit'): Promise<CliRun>;
  ```

- [ ] **Step 1: Write the fake bin** `test/fixtures/fake-cli.mjs`. It is driven by environment variables so one file serves every case: `FAKE_STDOUT` (written to stdout), `FAKE_STDERR` (written to stderr), `FAKE_EXIT` (exit code, default `0`), `FAKE_STDOUT_BYTES` (write that many `x` bytes instead), `FAKE_ARGS_FILE` (write `JSON.stringify(process.argv.slice(2))` to that path).

- [ ] **Step 2: Write the failing tests** in `test/run-cli.test.ts`:

  ```ts
  it('builds the argument list', ...)
  // cliArgs('md', { path: 'apps/web' }) → ['apps/web', '--reporter', 'md']
  // cliArgs('github', { path: '.', diff: 'origin/main', baseline: 'origin/main' })
  //   → ['.', '--reporter', 'github', '--diff', 'origin/main', '--baseline', 'origin/main']

  it('passes the arguments to the bin', ...)        // FAKE_ARGS_FILE round-trip
  it('captures stdout, stderr and exit code 0', ...) // FAKE_STDOUT='# report', FAKE_STDERR='svelte-vitals: note'
  it.each([1, 2])('reports exit code %i', ...)
  it('captures a report larger than the pipe buffer', ...) // FAKE_STDOUT_BYTES=5_000_000 → stdout.length === 5_000_000
  it('reports a bin that cannot start', ...)
  // runCli('/nonexistent/bin.js', [], 'capture') → node exits non-zero with its own stderr:
  // code is a number !== 0 and stderr mentions the path
  it('returns empty strings in inherit mode', ...)  // code 0, stdout === '' and stderr === ''
  ```

- [ ] **Step 3: Run them and watch them fail**

  Run: `pnpm exec vitest run test/run-cli.test.ts`
  Expected: FAIL, cannot resolve `../src/run-cli.js`.

- [ ] **Step 4: Implement `src/run-cli.ts`** with `spawn(process.execPath, [bin, ...args])`. Collect chunks and resolve on `close`, so a large report neither truncates nor blocks. `failure` is set from the `error` event or a non-null signal.

- [ ] **Step 5: Run the tests**

  Run: `pnpm exec vitest run test/run-cli.test.ts`
  Expected: PASS.

- [ ] **Step 6: Commit**

  ```bash
  git add src/run-cli.ts test/run-cli.test.ts test/fixtures/fake-cli.mjs
  git commit -m "feat: run a svelte-vitals bin as a subprocess"
  ```

### Task 3: Wire `main()`

**Files:**

- Create: `src/fallback-message.ts`
- Modify: `src/index.ts`
- Test: `test/fallback-message.test.ts`
- Test: `test/index.test.ts`

**Interfaces:**

- Consumes: `resolveProjectCli`, `CliResolution`, `MIN_CLI_VERSION` (Task 1); `cliArgs`, `runCli`, `CliRun` (Task 2).
- Produces:

  ```ts
  // src/fallback-message.ts
  export interface FallbackMessage {
    level: 'warning' | 'notice';
    text: string;
  }
  export function fallbackMessage(
    resolution: Exclude<CliResolution, { kind: 'installed' }>,
    bundledVersion: string
  ): FallbackMessage;
  ```

  Exact texts (`X` = bundled version):
  - `missing` with `declared`, level `warning`:
    `svelte-vitals: analyzed with the bundled svelte-vitals X. This project declares svelte-vitals <declared> but it is not installed. Install dependencies before this step to analyze with the project's version.`
  - `too-old`, level `warning`:
    `svelte-vitals: analyzed with the bundled svelte-vitals X. The installed svelte-vitals <version> is older than 0.44.0, the oldest version this action can run.`
  - `missing` without `declared`, level `notice`:
    `svelte-vitals: analyzed with the bundled svelte-vitals X. Add svelte-vitals as a devDependency and install it before this step to choose the version CI analyzes with.`

- [ ] **Step 1: Write the failing tests for the messages** in `test/fallback-message.test.ts`: one per situation, asserting `level` and the full `text`.

- [ ] **Step 2: Run, watch fail, implement `src/fallback-message.ts`, run again**

  Run: `pnpm exec vitest run test/fallback-message.test.ts`
  Expected: FAIL first (module missing), PASS after.

- [ ] **Step 3: Write the failing tests for `main()`** in `test/index.test.ts`. The file already mocks the SDKs; add `notice` to the `@actions/core` mock, and mock `../src/resolve-cli.js` and `../src/run-cli.js` (these two are this repository's own seams, unit-tested for real in Tasks 1 and 2). Mock only `resolveProjectCli` and `runCli`; keep `cliArgs` real through `importOriginal`. Default the resolver mock to `{ kind: 'missing' }` so every existing test keeps exercising the bundled path unchanged.

  New cases, with the resolver returning `{ kind: 'installed', version: '0.50.0', bin: '/p/node_modules/svelte-vitals/dist/bin.js' }`:

  ```ts
  it('runs the installed CLI twice and publishes its markdown', ...)
  // run 1 → { code: 0, stdout: '<!-- svelte-vitals v0.50.0 -->\n# report', stderr: '' }
  // expect runCli calls: (bin, ['.', '--reporter', 'md'], 'capture') then (bin, ['.', '--reporter', 'github'], 'inherit')
  // expect addRaw called with run 1's stdout; analyzeProject NOT called; setFailed NOT called

  it('passes path, diff and baseline through to both runs', ...)
  // inputs path='apps/web', diff='origin/main', baseline='origin/main'

  it('resolves from the path input up to the workspace', ...)
  // GITHUB_WORKSPACE='/ws', path='apps/web' → resolveProjectCli(resolve('apps/web'), '/ws')

  it('posts the installed CLI markdown as the sticky comment', ...)
  // same-repo PR + token → createComment body === `${STICKY_COMMENT_MARKER}\n${stdout}`

  it('fails after publishing when the CLI exits 1', ...)
  // addRaw called, then setFailed('svelte-vitals found blocking issues (see annotations above).')

  it('fails with the CLI stderr and publishes nothing when it exits 2', ...)
  // run 1 → { code: 2, stdout: '', stderr: 'svelte-vitals: unknown rule id(s) in rules: x\n' }
  // setFailed('svelte-vitals: unknown rule id(s) in rules: x'); addRaw NOT called; runCli called once

  it('fails with what happened when the CLI cannot start', ...)
  // run 1 → { code: null, stdout: '', stderr: '', failure: 'spawn ENOENT' }
  // setFailed message contains 'spawn ENOENT'; runCli called once; analyzeProject NOT called

  it('turns the first run stderr lines into warnings', ...)
  // stderr 'svelte-vitals: a\n\nsvelte-vitals: b\n', code 0 → warning called with each non-empty line, twice in total

  it('ignores the second run exit code', ...)
  // run 1 code 0, run 2 code 1 → setFailed NOT called
  ```

  And for the fallback, with the resolver returning each non-installed kind:

  ```ts
  it('warns when the project declares svelte-vitals but has not installed it', ...)
  // resolver → { kind: 'missing', declared: '^0.55.0' }; analyzeProject version '0.55.5'
  // warning called with fallbackMessage(...).text; analysis still runs; runCli NOT called

  it('warns when the installed version is too old', ...)
  it('notes, without warning, when svelte-vitals is neither declared nor installed', ...)
  // notice called with the text; warning NOT called with it
  ```

- [ ] **Step 4: Run them and watch them fail**

  Run: `pnpm exec vitest run test/index.test.ts`
  Expected: the new cases FAIL (runCli never called, notice not a function); the existing cases still PASS.

- [ ] **Step 5: Rework `src/index.ts`.**
  - Extract the summary write and the sticky-comment block into `async function publish(markdown: string, token: string): Promise<void>`, behaviour unchanged (fork skip, comment failure only warns).
  - `main()`: read inputs; `resolveProjectCli(resolve(path), process.env.GITHUB_WORKSPACE ?? resolve(path))`; branch.
  - Installed branch: run 1 capture. `failure` or a `code` outside `0|1|2` → `setFailed` naming the bin, the code and `failure`/stderr, return. `code === 2` → `setFailed(stderr.trim() || 'svelte-vitals exited with code 2.')`, return. Otherwise: warn per non-empty stderr line, run 2 inherit, `publish(stdout, token)`, then `setFailed(...)` with the existing blocking-issues message when `code === 1`.
  - Fallback branch: the existing in-process code, with `fallbackMessage(resolution, version)` emitted through `core.warning` or `core.notice` once `analysis.version` is known.

- [ ] **Step 6: Run the whole suite**

  Run: `pnpm test`
  Expected: PASS, every file.

- [ ] **Step 7: Lint and typecheck**

  Run: `pnpm lint && pnpm typecheck`
  Expected: both exit 0.

- [ ] **Step 8: Commit**

  ```bash
  git add src test
  git commit -m "feat: analyze with the project's installed svelte-vitals when there is one"
  ```

### Task 4: End-to-end guard

**Files:**

- Create: `test/e2e/workspace/package.json`, `test/e2e/workspace/package-lock.json`
- Create: `test/e2e/workspace/app/package.json`, `test/e2e/workspace/app/svelte.config.js`, `test/e2e/workspace/app/src/routes/+page.svelte`
- Create: `test/e2e/run.mjs`
- Modify: `.github/workflows/ci.yml`, `package.json` (script), `renovate.json`

**Interfaces:**

- Consumes: the built `dist/index.js`.

The layout exercises the hoisted case for real: `svelte-vitals` is installed in `test/e2e/workspace/`, and the analyzed project is `test/e2e/workspace/app/`, which declares `@sveltejs/kit` and `svelte` only so the CLI recognises a SvelteKit project. Nothing is installed inside `app/`.

- [ ] **Step 1: Write the fixture.**
  - `test/e2e/workspace/package.json`: `{ "name": "e2e-workspace", "private": true, "devDependencies": { "svelte-vitals": "0.44.0" } }` (exact version: the minimum this action supports).
  - `test/e2e/workspace/app/package.json`: `{ "name": "e2e-app", "private": true, "type": "module", "devDependencies": { "@sveltejs/kit": "^2.0.0", "svelte": "^5.0.0", "svelte-vitals": "0.44.0" } }`.
  - `app/svelte.config.js`: `export default {};`. `app/src/routes/+page.svelte`: a page with a `<title>` in `<svelte:head>` and an `<h1>`.
  - Generate the lockfile: `npm install --ignore-scripts --no-audit --no-fund` inside `test/e2e/workspace/`, commit `package-lock.json` only (`node_modules/` is already ignored).

- [ ] **Step 2: Write `test/e2e/run.mjs`** (Node builtins only). It spawns `process.execPath dist/index.js` from the repository root with `INPUT_PATH=test/e2e/workspace/app`, `GITHUB_WORKSPACE=<repo root>`, `GITHUB_STEP_SUMMARY=<a fresh temp file>`, `GITHUB_EVENT_NAME=push`, `GITHUB_REPOSITORY=oekazuma/svelte-vitals-action`, and no token. It then asserts, exiting `1` with a message on the first miss:
  - the summary file contains `<!-- svelte-vitals v0.44.0 -->` (the installed CLI wrote the report);
  - the child's stdout does not contain `analyzed with the bundled svelte-vitals` (no fallback);
  - the child exited `0` or `1` (`1` is the gate firing on the fixture's own findings, which is fine).

- [ ] **Step 3: Run it before the build includes the feature and watch it fail.** Check out `dist/index.js` from `origin/main` (`git show origin/main:dist/index.js > dist/index.js`), install the fixture (`npm ci --ignore-scripts` in `test/e2e/workspace/`), then:

  Run: `node test/e2e/run.mjs`
  Expected: FAIL on the first assertion (the old bundle reports its own version).

- [ ] **Step 4: Build and run again**

  Run: `pnpm build && node test/e2e/run.mjs`
  Expected: PASS.

- [ ] **Step 5: Wire it into CI.** Add a `test:e2e` script (`node test/e2e/run.mjs`). In `.github/workflows/ci.yml`, after the dist check, add a step that runs `npm ci --ignore-scripts` with `working-directory: test/e2e/workspace`, then `pnpm test:e2e`.

- [ ] **Step 6: Keep Renovate off the fixture.** Add `"ignorePaths": ["test/e2e/**"]` to `renovate.json`: the fixture's version is the supported minimum, not a dependency to bump.

- [ ] **Step 7: Lint, then commit**

  Run: `pnpm lint`
  Expected: exit 0 (if the fixture trips oxlint or oxfmt, add `test/e2e/workspace` to their ignore patterns rather than reformatting a lockfile).

  ```bash
  git add test/e2e .github/workflows/ci.yml package.json renovate.json .oxlintrc.json .oxfmtrc.json
  git commit -m "test: run the built action against a project with svelte-vitals 0.44.0 installed"
  ```

### Task 5: Docs, bundle and changeset

**Files:**

- Modify: `README.md`, `AGENTS.md`, `dist/index.js`
- Create: `.changeset/<name>.md`

- [ ] **Step 1: README.** Replace the claim that the action runs "the same analysis as the `svelte-vitals` CLI" with what now holds, as a snapshot of current behaviour: the action runs the `svelte-vitals` installed in the project (found from `path` upward), so CI analyzes with the version in the lockfile; without an install it analyzes with the bundled version and says so in a warning or notice. Add an install step to the hand-written workflow example (`npm ci --ignore-scripts` as the shown default, with one line saying to use the project's package manager). State the minimum installed version (0.44.0) and that the scan runs twice.

- [ ] **Step 2: AGENTS.md.** Add `pnpm test:e2e` (and its `npm ci` in `test/e2e/workspace`) to the verify commands, and one hard rule: the installed path's contract with the CLI is the command line only (flags, reporter names, exit codes), never an import from the project's package.

- [ ] **Step 3: Rebuild**

  Run: `pnpm build && git status --porcelain -- dist`
  Expected: `dist/index.js` modified (or already current from Task 4).

- [ ] **Step 4: Changeset** (`minor`), written for someone running the action in CI. It says: with `svelte-vitals` installed in the project the action now analyzes and renders with that version instead of the bundled one, so findings, the report and the gate match a local run; the scan runs twice; installed versions below 0.44.0 and projects without an install keep the bundled analyzer and get a warning or notice; inputs are unchanged; add an install step to benefit.

- [ ] **Step 5: Verify everything**

  Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e && git status --porcelain -- dist`
  Expected: every command exits 0 and the last prints nothing.

- [ ] **Step 6: Commit**

  ```bash
  git add README.md AGENTS.md dist .changeset
  git commit -m "docs: describe running the project's installed svelte-vitals"
  ```
