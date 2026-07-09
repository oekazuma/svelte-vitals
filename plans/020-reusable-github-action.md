# Plan 020: `@svelte-vitals/action` — reusable GitHub Action replacing the inline `ci install` template

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `test -f docs/superpowers/specs/2026-07-09-github-action-design.md && echo OK` must print `OK` (design doc must exist and be approved — see its `Status` header). Then:
> `sed -n '296,341p' packages/cli/src/index.ts` — if this range no longer matches the "`--staged`/`--diff` gating... `--baseline`..." block described in Step 2 below (e.g. because another plan already refactored it), STOP and reconcile Step 2 against the real current code before proceeding.

**Goal:** Ship `packages/action`, a first-party JS GitHub Action that runs svelte-vitals in-process (no `npx`) and replaces `ci install`'s ~60-line inline workflow template with a short call to `uses: oekazuma/svelte-vitals/packages/action@<sha> # @svelte-vitals/action@<version>`.

**Architecture:** New private package `@svelte-vitals/action` depends on `svelte-vitals` and `@svelte-vitals/core` (workspace) plus `@actions/core`/`@actions/github`, bundled via tsup into a single committed `dist/index.js`. `packages/cli` gains one new exported function (`applyScope`, extracted from `run()`) so the action can replicate `--diff`/`--staged`/`--baseline` scoping without duplicating git orchestration, and a build-time codegen script that embeds the action's current commit SHA + version into the `ci install` template.

**Tech Stack:** TypeScript, tsup (bundling), `@actions/core` + `@actions/github` (Action runtime), vitest.

## Global Constraints

- **Core purity**: no `node:` imports or I/O in `packages/core` (unchanged by this plan — no core code changes).
- **Dependencies via catalog**: `@actions/core` and `@actions/github` go into `pnpm-workspace.yaml`'s `catalog:` block, referenced as `catalog:` in `packages/action/package.json` — never literal versions.
- **Changesets required**: this is user-facing (new Action + changed `ci install` output) — needs changesets for `svelte-vitals` (minor) at minimum. `@svelte-vitals/action` is private and never `npm publish`ed, but still gets a changeset so it participates in normal version-bump tracking.
- **en/ja docs stay in sync**: `docs/src/content/docs/guides/ci.md` and `docs/src/content/docs/ja/guides/ci.md` must be updated together.
- **ESM-only**: every package in this repo is ESM-only by design (issue #20) — `packages/action`'s tsup config must never add `'cjs'` to `format`.

---

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED (new package + a refactor of `run()`'s diff/baseline block that existing tests must still cover; a wrong action bundle breaks every consumer's CI)
- **Depends on**: — (Plans 014/015 already merged; this plan builds on their output)
- **Category**: direction (issue #154)
- **Planned at**: commit `e432902`, 2026-07-09

## Why this matters

Issue #154: `ci install` generates a full inline workflow that consumer repos end up hand-rewriting (doesn't match their CI conventions), embeds the CLI version as a `run:`-block string Dependabot/Renovate can't bump, and makes the sticky-comment `github-script` logic "our code" every consumer now owns. `plans/README.md`'s 2026-07-08 gap analysis explicitly deferred building a marketplace Action until "the template's complexity hits its limit" — issue #154 is that limit being hit. Full design: `docs/superpowers/specs/2026-07-09-github-action-design.md`.

## Current state

- **`analyzeProject`** (`packages/cli/src/index.ts:154-189`) runs static analysis and returns `{ results, config, version, warnings }`. It does **not** accept `diffBase`/`baseline` — those are resolved by `run()` itself.
- **`run()`** (`packages/cli/src/index.ts:195-404`) is the full CLI orchestration: calls `analyzeProject`, then (lines 296-341) scopes `results` via `--staged`/`--diff` (`getChangedFiles`/`filterToChangedFiles`, `packages/cli/src/changed-files.ts`) and `--baseline` (`checkoutBaseline`/`filterToNewFindings`, `packages/cli/src/baseline.ts`), then dispatches to a reporter and computes the exit code (`hasFailureAtOrAbove(summarize(results, config), config.failOn)`, both from `@svelte-vitals/core`).
- **None of `getChangedFiles`/`filterToChangedFiles`/`checkoutBaseline`/`filterToNewFindings` is exported** from `packages/cli/src/index.ts`'s public export list (lines 406-413) — they're internal to `run()`.
- **`packages/mcp`** already imports `analyzeProject`, `buildRulesConfig`, etc. directly from `svelte-vitals` (`packages/mcp/src/tools/analyze.ts`) — the precedent this plan's action package follows (in-process reuse, not subprocess).
- **Reporters already exist** in `@svelte-vitals/core`: `formatGithubReport(results, config): string` (workflow-command annotations, `packages/core/src/reporter/github.ts`), `formatMarkdownReport(results, config, { version }): string` (`packages/core/src/reporter/markdown.ts`, already emits its own `<!-- svelte-vitals vX -->` marker — separate from the sticky-comment marker below).
- **Current inline template** (`packages/cli/src/ci/workflow.ts`): `buildWorkflowYaml({ version })` returns the full ~60-line YAML (checkout, setup-node, two `npx -y svelte-vitals@<version>` runs, inline `github-script` sticky comment using marker `<!-- svelte-vitals-report -->`, gate step). `packages/cli/src/ci/cli.ts`'s `runCiCli` calls `readPackageVersion()` and passes it in.
- **Repo's own SHA-pin convention**: `.github/workflows/ci.yml`/`release.yml` pin every third-party action as `uses: owner/repo@<40-hex-sha> # vX.Y.Z` (same-line comment) — the format issue #154 asked `ci install`'s output to match.
- **pnpm catalog**: `pnpm-workspace.yaml`'s `catalog:` block has no `@actions/core`/`@actions/github` entries yet.
- **Verified: changesets tags private packages too.** `@changesets/cli`'s `publish` command (`packages/cli/src/commands/publish/index.ts` in the `changesets/changesets` repo) treats a private package's pending release as `kind: 'tag-only'` and creates a git tag `${pkg.name}@${pkg.version}` for it via the same `tagPublish` path used for npm-published packages — it just skips the npm-publish call. `changesets/action` (this repo's `release.yml`) reads that same tag-creation event stream regardless of publish/tag-only, so no changes to `release.yml` are needed for `@svelte-vitals/action` to get tagged — confirms design doc Decision 4.
- **`.gitignore`**: blanket `dist/` (no leading slash → matches at any depth). `packages/action/dist` needs an explicit negation to be tracked.

## Commands you will need

| Purpose   | Command                                                        | Expected on success |
| --------- | --------------------------------------------------------------- | -------------------- |
| Install   | `pnpm install`                                                   | exit 0                |
| Build     | `pnpm build`                                                     | exit 0                |
| Typecheck | `pnpm typecheck`                                                 | exit 0                |
| Tests     | `pnpm test`                                                      | all pass              |
| Lint      | `pnpm lint`                                                      | exit 0                |
| Changeset | `pnpm changeset` (svelte-vitals: minor, @svelte-vitals/action: minor) | files generated  |

## Scope

**In scope:**

- `packages/cli/src/index.ts` (extract + export `applyScope`)
- `packages/cli/test/apply-scope.test.ts` (new)
- `packages/cli/src/ci/workflow.ts`, `packages/cli/src/ci/cli.ts` (new short template)
- `packages/cli/test/ci/workflow.test.ts`, `packages/cli/test/ci/cli.test.ts` (rewritten assertions)
- `packages/cli/scripts/gen-action-pin.mjs` (new), `packages/cli/package.json` (script wiring)
- `packages/action/` (new package: `action.yml`, `src/`, `test/`, `dist/` committed)
- `pnpm-workspace.yaml` (catalog additions)
- `.gitignore` (unignore `packages/action/dist`, ignore the generated pin file)
- `.github/workflows/ci.yml` (`check` job: dist-freshness step)
- `docs/src/content/docs/guides/ci.md` + `ja/guides/ci.md`
- `plans/README.md` (status row + backlog note update)
- `.changeset/`

**Out of scope:**

- `fail-on`/`min-health` inputs on the action (current inline template doesn't expose them either).
- Action `outputs:` for downstream steps.
- A floating `v0`/`v1` major tag (design doc Decision 4 — declined).
- Automatic migration/detection of the old inline-template workflow shape (`--force` covers it).
- GitLab CI / other non-GitHub-Actions templates.

## Git workflow

- Branch: `advisor/020-reusable-github-action`
- Conventional commits, e.g. `refactor(cli): extract applyScope from run()` / `feat(action): add @svelte-vitals/action` / `feat(cli): scaffold the Action call instead of the inline workflow`
- PR body in English. No benchmark-tool names in commits/PR/docs (repo convention).
- push / PR creation only on operator instruction.

## Steps

### Step 1: Add `@actions/core`/`@actions/github` to the pnpm catalog

- [ ] **1.1** Open `pnpm-workspace.yaml`. The existing `catalog:` block is not strictly alphabetized (e.g. `@astrojs/check` already sits after `@clack/prompts`) — add these two lines anywhere in the block, e.g. right after the `catalog:` key:

```yaml
  '@actions/core': ^3.0.1
  '@actions/github': ^9.1.1
```

(Versions confirmed current on the npm registry as of this plan's writing — re-check `npm view @actions/core version` / `npm view @actions/github version` if executing this step much later.)

- [ ] **1.2** Verify: `grep -n "@actions/core\|@actions/github" pnpm-workspace.yaml` prints both lines.
- [ ] **1.3** Commit:

```bash
git add pnpm-workspace.yaml
git commit -m "chore: add @actions/core and @actions/github to the pnpm catalog"
```

### Step 2: Extract `applyScope` from `run()` (packages/cli)

This is a behavior-preserving refactor: `run()`'s diff/staged/baseline block becomes a standalone exported function so `packages/action` can reuse it without duplicating git orchestration. Existing `run-diff.test.ts`/`run-baseline.test.ts` (which mock `../src/changed-files.js`/`../src/baseline.js` at the module level) must keep passing unchanged — that's the regression check.

- [ ] **2.1** Write the failing test. Create `packages/cli/test/apply-scope.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

vi.mock('../src/changed-files.js', async (orig) => {
  const actual = await orig<typeof import('../src/changed-files.js')>();
  return { ...actual, getChangedFiles: vi.fn() };
});
vi.mock('../src/baseline.js', async (orig) => {
  const actual = await orig<typeof import('../src/baseline.js')>();
  return { ...actual, checkoutBaseline: vi.fn() };
});

import { applyScope } from '../src/index.js';
import { getChangedFiles } from '../src/changed-files.js';
import { checkoutBaseline } from '../src/baseline.js';
import type { Result } from '@svelte-vitals/core';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures', 'basic-project');
const mockGet = vi.mocked(getChangedFiles);
const mockCheckout = vi.mocked(checkoutBaseline);

function result(over: Partial<Result> = {}): Result {
  return {
    id: 'SEO001',
    severity: 'critical',
    detection: { presence: 'own', value: 'static' },
    message: 'test finding',
    location: 'src/routes/+page.svelte',
    ...over
  };
}

describe('applyScope', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockCheckout.mockReset();
  });

  it('returns results unchanged when no scoping option is given', async () => {
    const results = [result()];
    const out = await applyScope(results, { cwd: '/proj' });
    expect(out).toBe(results);
  });

  it('filters to changed files for --diff', async () => {
    mockGet.mockReturnValue(new Set(['src/routes/+page.svelte']));
    const out = await applyScope([result(), result({ location: 'src/routes/other.svelte' })], {
      cwd: '/proj',
      diffBase: 'origin/main'
    });
    expect(out).toHaveLength(1);
    expect(mockGet).toHaveBeenCalledWith('/proj', { base: 'origin/main' });
  });

  it('--staged takes precedence and queries staged files', async () => {
    mockGet.mockReturnValue(new Set());
    await applyScope([result()], { cwd: '/proj', staged: true, diffBase: 'origin/main' });
    expect(mockGet).toHaveBeenCalledWith('/proj', { staged: true });
  });

  it('warns via errorLog and keeps all results when git cannot answer --diff', async () => {
    mockGet.mockReturnValue(undefined);
    const errorLog = vi.fn();
    const out = await applyScope([result()], { cwd: '/proj', diffBase: 'origin/main', errorLog });
    expect(out).toHaveLength(1);
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('could not determine changed files'));
  });

  it('drops findings already present at the baseline ref', async () => {
    // Point the "baseline checkout" at the same fixture project as `cwd` — baseline
    // analysis then finds the exact same findings as current, so filterToNewFindings
    // removes everything. Mirrors run-baseline.test.ts's proven pattern.
    const cleanup = vi.fn();
    mockCheckout.mockReturnValue({ analyzeCwd: fixtureDir, cleanup });
    const out = await applyScope([result({ location: 'src/routes/+page.svelte' })], {
      cwd: fixtureDir,
      baseline: 'origin/main'
    });
    expect(out).toHaveLength(0);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('warns via errorLog and keeps all results when the baseline ref cannot be resolved', async () => {
    mockCheckout.mockReturnValue(undefined);
    const errorLog = vi.fn();
    const out = await applyScope([result()], { cwd: '/proj', baseline: 'bogus-ref', errorLog });
    expect(out).toHaveLength(1);
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("could not analyze baseline 'bogus-ref'"));
  });

  it('warns via errorLog and keeps all results when baseline analysis itself throws', async () => {
    const cleanup = vi.fn();
    // analyzeCwd points at a non-SvelteKit directory (the fixtures dir itself, one level
    // up) so analyzeProject's detectProject throws ProjectError, exercising the catch branch.
    mockCheckout.mockReturnValue({ analyzeCwd: here, cleanup });
    const errorLog = vi.fn();
    const out = await applyScope([result()], { cwd: fixtureDir, baseline: 'origin/main', errorLog });
    expect(out).toHaveLength(1);
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("baseline analysis of 'origin/main' failed"));
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **2.2** Run it to confirm it fails (the export doesn't exist yet):

Run: `pnpm --filter svelte-vitals test apply-scope`
Expected: FAIL — `applyScope is not exported from '../src/index.js'` (or similar).

- [ ] **2.3** In `packages/cli/src/index.ts`, add the new exported type + function directly after the `analyzeProject` function (after line 189, before the `spinnerEnabled`/`run()` block that currently follows — insertion point: right before the existing `/**\n * Run static-mode analysis once and return the process exit code...` comment for `run()`):

```ts
export interface ApplyScopeOptions {
  cwd: string;
  staged?: boolean;
  diffBase?: string;
  baseline?: string;
  errorLog?: (line: string) => void;
  analyzeOpts?: AnalyzeOptions;
}

/**
 * Narrow `results` to what a PR gate cares about: `--staged`/`--diff` restrict to
 * changed files, `--baseline` drops findings that already existed at that ref. Shared
 * by `run()` and `@svelte-vitals/action` (issue #154) so the git-diff/baseline
 * orchestration lives in exactly one place.
 */
export async function applyScope(results: Result[], opts: ApplyScopeOptions): Promise<Result[]> {
  const errorLog = opts.errorLog ?? ((line: string) => console.error(line));
  let scoped = results;

  if (opts.staged || opts.diffBase !== undefined) {
    const changed = opts.staged
      ? getChangedFiles(opts.cwd, { staged: true })
      : getChangedFiles(opts.cwd, { base: opts.diffBase });
    if (changed === undefined) {
      errorLog(
        'svelte-vitals: could not determine changed files (not a git repo, git unavailable, or bad ref); analyzing all.'
      );
    } else {
      scoped = filterToChangedFiles(scoped, changed);
    }
  }

  if (opts.baseline !== undefined) {
    const checkout = checkoutBaseline(opts.cwd, opts.baseline);
    if (checkout === undefined) {
      errorLog(
        `svelte-vitals: could not analyze baseline '${opts.baseline}' (not a git repo, git unavailable, or bad ref); reporting all findings.`
      );
    } else {
      try {
        const base = await analyzeProject({ ...opts.analyzeOpts, cwd: checkout.analyzeCwd });
        scoped = filterToNewFindings(scoped, base.results);
      } catch {
        errorLog(`svelte-vitals: baseline analysis of '${opts.baseline}' failed; reporting all findings.`);
      } finally {
        checkout.cleanup();
      }
    }
  }

  return scoped;
}
```

- [ ] **2.4** Replace `run()`'s inline block. Find (lines 298-341 in the current file):

```ts
  try {
    const { config, version } = analysis;
    let results = analysis.results;

    // --staged / --diff: scope findings to the changed files (gate "what the agent wrote").
    if (opts.staged || opts.diffBase !== undefined) {
      const changed = opts.staged
        ? getChangedFiles(cwd, { staged: true })
        : getChangedFiles(cwd, { base: opts.diffBase });
      if (changed === undefined) {
        errorLog(
          'svelte-vitals: could not determine changed files (not a git repo, git unavailable, or bad ref); analyzing all.'
        );
      } else {
        results = filterToChangedFiles(results, changed);
      }
    }

    if (opts.baseline !== undefined) {
      const checkout = checkoutBaseline(cwd, opts.baseline);
      if (checkout === undefined) {
        errorLog(
          `svelte-vitals: could not analyze baseline '${opts.baseline}' (not a git repo, git unavailable, or bad ref); reporting all findings.`
        );
      } else {
        try {
          const base = await analyzeProject({
            cwd: checkout.analyzeCwd,
            metaComponents: opts.metaComponents,
            treatDynamicAs: opts.treatDynamicAs,
            route: opts.route,
            failOn: opts.failOn,
            rules: opts.rules,
            weights: opts.weights,
            categories: opts.categories
          });
          results = filterToNewFindings(results, base.results);
        } catch {
          errorLog(`svelte-vitals: baseline analysis of '${opts.baseline}' failed; reporting all findings.`);
        } finally {
          checkout.cleanup();
        }
      }
    }
```

Replace with:

```ts
  try {
    const { config, version } = analysis;
    const results = await applyScope(analysis.results, {
      cwd,
      staged: opts.staged,
      diffBase: opts.diffBase,
      baseline: opts.baseline,
      errorLog,
      analyzeOpts: {
        metaComponents: opts.metaComponents,
        treatDynamicAs: opts.treatDynamicAs,
        route: opts.route,
        failOn: opts.failOn,
        rules: opts.rules,
        weights: opts.weights,
        categories: opts.categories
      }
    });
```

Everything after this (the `if (opts.score)`/reporter dispatch block, unchanged) still refers to `results`/`config`/`version` exactly as before — only the declaration changed from `let results = ...; if (...) { results = ... }` to a single `const results = await applyScope(...)`.

- [ ] **2.5** Run the new test and the full diff/baseline regression suite:

Run: `pnpm --filter svelte-vitals test apply-scope run-diff run-baseline`
Expected: all PASS.

- [ ] **2.6** Run the full CLI test suite (nothing else should have moved):

Run: `pnpm --filter svelte-vitals test`
Expected: all PASS, same count as before this step (no new failures, no skipped).

- [ ] **2.7** Typecheck: `pnpm --filter svelte-vitals typecheck` → exit 0.

- [ ] **2.8** Commit:

```bash
git add packages/cli/src/index.ts packages/cli/test/apply-scope.test.ts
git commit -m "refactor(cli): extract applyScope from run() for reuse by @svelte-vitals/action"
```

### Step 3: Scaffold `packages/action`

- [ ] **3.1** Create `packages/action/package.json`:

```json
{
  "name": "@svelte-vitals/action",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "First-party GitHub Action running svelte-vitals in CI — annotations, job summary, sticky PR comment.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/oekazuma/svelte-vitals.git",
    "directory": "packages/action"
  },
  "engines": {
    "node": ">=22.13.0"
  },
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "svelte-vitals": "workspace:*",
    "@svelte-vitals/core": "workspace:*",
    "@actions/core": "catalog:",
    "@actions/github": "catalog:"
  },
  "devDependencies": {
    "@types/node": "catalog:"
  }
}
```

- [ ] **3.2** Create `packages/action/tsconfig.json` (mirrors `packages/cli/tsconfig.json`):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```

- [ ] **3.3** Create `packages/action/tsup.config.ts`:

```ts
import { defineConfig } from 'tsup';

// ESM-only by design (issue #20) — never add 'cjs'. Everything is bundled (noExternal)
// because GitHub Actions runs dist/index.js standalone — there is no `npm install`
// step for a JS action's own dependencies.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  noExternal: [/.*/],
  clean: true,
  target: 'es2022'
});
```

- [ ] **3.4** Create `packages/action/action.yml`:

```yaml
name: 'svelte-vitals'
description: 'Static SvelteKit code-health checks (SEO, Performance, Correctness, Security, Architecture) — PR annotations, job summary, and a sticky summary comment.'
inputs:
  path:
    description: 'Project directory to analyze'
    required: false
    default: '.'
  diff:
    description: 'Scope findings to files changed vs this git ref (e.g. origin/main)'
    required: false
  baseline:
    description: 'Report only findings not already present at this git ref'
    required: false
  github-token:
    description: 'Token used to read/post/update the sticky PR comment'
    required: false
    default: ${{ github.token }}
runs:
  using: 'node24'
  main: 'dist/index.js'
```

- [ ] **3.5** Create a placeholder `packages/action/src/index.ts` so the package builds end-to-end before the real logic lands:

```ts
export {};
```

- [ ] **3.6** Add `packages/action` to the root workspace filters that need it. Check `package.json`'s `check:publint`/`check:types` scripts — **do not** add `@svelte-vitals/action` to either filter list (it's private, never npm-published; those checks validate publishable packages only).

- [ ] **3.7** Install and build:

Run: `pnpm install && pnpm --filter @svelte-vitals/action build`
Expected: exit 0, `packages/action/dist/index.js` created.

- [ ] **3.8** Typecheck: `pnpm --filter @svelte-vitals/action typecheck` → exit 0.

- [ ] **3.9** Commit:

```bash
git add packages/action pnpm-lock.yaml
git commit -m "feat(action): scaffold @svelte-vitals/action package"
```

### Step 4: `fork.ts` — fork-PR detection (pure, TDD)

- [ ] **4.1** Write the failing test. Create `packages/action/test/fork.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isForkPR } from '../src/fork.js';

describe('isForkPR', () => {
  it('is false for a non-pull_request event', () => {
    expect(isForkPR({ eventName: 'push', repoFullName: 'oekazuma/svelte-vitals' })).toBe(false);
  });

  it('is false when there is no head repo info (e.g. push-triggered analysis)', () => {
    expect(isForkPR({ eventName: 'pull_request', repoFullName: 'oekazuma/svelte-vitals' })).toBe(false);
  });

  it('is false for a same-repo PR', () => {
    expect(
      isForkPR({
        eventName: 'pull_request',
        repoFullName: 'oekazuma/svelte-vitals',
        headRepoFullName: 'oekazuma/svelte-vitals'
      })
    ).toBe(false);
  });

  it('is true for a fork PR', () => {
    expect(
      isForkPR({
        eventName: 'pull_request',
        repoFullName: 'oekazuma/svelte-vitals',
        headRepoFullName: 'someone-else/svelte-vitals'
      })
    ).toBe(true);
  });
});
```

- [ ] **4.2** Run to confirm it fails: `pnpm --filter @svelte-vitals/action test fork` → FAIL (module not found).

- [ ] **4.3** Create `packages/action/src/fork.ts`:

```ts
export interface PullRequestContext {
  eventName: string;
  repoFullName: string;
  headRepoFullName?: string;
}

/**
 * True when running on a PR whose head repo differs from the base repo. GitHub
 * downgrades `GITHUB_TOKEN` to read-only on fork PRs, so posting a comment there
 * would fail — the caller should skip the sticky-comment step but still emit
 * annotations and the job summary.
 */
export function isForkPR(ctx: PullRequestContext): boolean {
  return ctx.eventName === 'pull_request' && ctx.headRepoFullName !== undefined && ctx.headRepoFullName !== ctx.repoFullName;
}
```

- [ ] **4.4** Run: `pnpm --filter @svelte-vitals/action test fork` → PASS.

- [ ] **4.5** Commit:

```bash
git add packages/action/src/fork.ts packages/action/test/fork.test.ts
git commit -m "feat(action): add fork-PR detection"
```

### Step 5: `sticky-comment.ts` — create/update decision (pure, TDD)

- [ ] **5.1** Write the failing test. Create `packages/action/test/sticky-comment.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { planStickyComment, STICKY_COMMENT_MARKER } from '../src/sticky-comment.js';

describe('planStickyComment', () => {
  it('creates when there is no existing marked comment', () => {
    expect(planStickyComment([{ id: 1, body: 'unrelated comment' }])).toEqual({ op: 'create' });
  });

  it('creates when the comment list is empty', () => {
    expect(planStickyComment([])).toEqual({ op: 'create' });
  });

  it('updates the existing marked comment, ignoring others', () => {
    const out = planStickyComment([
      { id: 1, body: 'unrelated comment' },
      { id: 2, body: `${STICKY_COMMENT_MARKER}\nold report` },
      { id: 3, body: 'another unrelated comment' }
    ]);
    expect(out).toEqual({ op: 'update', id: 2 });
  });

  it('treats a null body as no match (never throws)', () => {
    expect(planStickyComment([{ id: 1, body: null }])).toEqual({ op: 'create' });
  });
});
```

- [ ] **5.2** Run to confirm it fails: `pnpm --filter @svelte-vitals/action test sticky-comment` → FAIL.

- [ ] **5.3** Create `packages/action/src/sticky-comment.ts`:

```ts
export const STICKY_COMMENT_MARKER = '<!-- svelte-vitals-report -->';

export interface ExistingComment {
  id: number;
  body: string | null | undefined;
}

export type StickyCommentPlan = { op: 'update'; id: number } | { op: 'create' };

/**
 * Decide whether to update a previous svelte-vitals report comment or create a new
 * one — keyed by a marker so repeated runs update the same comment instead of piling
 * up new ones (ported from the inline `github-script` template it replaces).
 */
export function planStickyComment(existing: ExistingComment[]): StickyCommentPlan {
  const mine = existing.find((c) => c.body?.startsWith(STICKY_COMMENT_MARKER));
  return mine ? { op: 'update', id: mine.id } : { op: 'create' };
}
```

- [ ] **5.4** Run: `pnpm --filter @svelte-vitals/action test sticky-comment` → PASS.

- [ ] **5.5** Commit:

```bash
git add packages/action/src/sticky-comment.ts packages/action/test/sticky-comment.test.ts
git commit -m "feat(action): add sticky PR comment create/update decision logic"
```

### Step 6: entrypoint (`src/index.ts`)

This wires `@actions/core`/`@actions/github` to `analyzeProject`/`applyScope` (from `svelte-vitals`) and the two pure modules above. It is a thin adapter — exercised by hand (see Step 6's verify note) rather than unit-tested, the same approach already used for the clack-backed `InstallPrompts` adapter in the install wizard (`docs/superpowers/specs/2026-07-03-cli-install-wizard-design.md` §5).

- [ ] **6.1** Replace `packages/action/src/index.ts`'s placeholder with:

```ts
import * as core from '@actions/core';
import * as github from '@actions/github';
import { analyzeProject, applyScope } from 'svelte-vitals';
import { formatGithubReport, formatMarkdownReport, summarize, hasFailureAtOrAbove } from '@svelte-vitals/core';
import { isForkPR } from './fork.js';
import { planStickyComment, STICKY_COMMENT_MARKER } from './sticky-comment.js';

async function main(): Promise<void> {
  const path = core.getInput('path') || '.';
  const diff = core.getInput('diff') || undefined;
  const baseline = core.getInput('baseline') || undefined;
  const token = core.getInput('github-token') || process.env.GITHUB_TOKEN || '';

  const analysis = await analyzeProject({ cwd: path });
  const { config, version } = analysis;
  const results = await applyScope(analysis.results, {
    cwd: path,
    diffBase: diff,
    baseline,
    errorLog: (line) => core.warning(line)
  });

  const annotations = formatGithubReport(results, config);
  if (annotations) core.info(annotations);

  const markdown = formatMarkdownReport(results, config, { version });
  await core.summary.addRaw(markdown).write();

  const ctx = github.context;
  const pr = ctx.payload.pull_request;
  if (pr && token) {
    const headFullName = (pr as { head?: { repo?: { full_name?: string } } }).head?.repo?.full_name;
    const fork = isForkPR({
      eventName: ctx.eventName,
      repoFullName: `${ctx.repo.owner}/${ctx.repo.repo}`,
      headRepoFullName: headFullName
    });
    if (!fork) {
      const octokit = github.getOctokit(token);
      const body = `${STICKY_COMMENT_MARKER}\n${markdown}`;
      const { data: comments } = await octokit.rest.issues.listComments({
        owner: ctx.repo.owner,
        repo: ctx.repo.repo,
        issue_number: pr.number,
        per_page: 100
      });
      const plan = planStickyComment(comments);
      if (plan.op === 'update') {
        await octokit.rest.issues.updateComment({
          owner: ctx.repo.owner,
          repo: ctx.repo.repo,
          comment_id: plan.id,
          body
        });
      } else {
        await octokit.rest.issues.createComment({
          owner: ctx.repo.owner,
          repo: ctx.repo.repo,
          issue_number: pr.number,
          body
        });
      }
    }
  }

  const summary = summarize(results, config);
  if (hasFailureAtOrAbove(summary, config.failOn)) {
    core.setFailed('svelte-vitals found blocking issues (see annotations above).');
  }
}

main().catch((err) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
```

- [ ] **6.2** Build and typecheck:

Run: `pnpm --filter @svelte-vitals/action build && pnpm --filter @svelte-vitals/action typecheck`
Expected: both exit 0.

- [ ] **6.3** Manual smoke test — run the built action entrypoint directly against this repo's own fixture project, faking the Actions env vars it reads (no `@actions/core` input prefix needed since `INPUT_<NAME>` env vars are how `core.getInput` reads values):

```bash
cd packages/action
INPUT_PATH=../cli/test/fixtures/basic-project \
GITHUB_EVENT_NAME=push \
GITHUB_REPOSITORY=oekazuma/svelte-vitals \
node dist/index.js; echo "exit: $?"
```

Expected: prints `::warning::`/`::error::` annotation lines (or nothing if the fixture is clean) to stdout, no crash. A non-PR event (`push`) means the sticky-comment branch is skipped (`ctx.payload.pull_request` is undefined) — this only exercises analysis + annotations + job-summary write, which is expected for this smoke test (posting a real PR comment requires a live token/PR and is out of scope for local verification).

- [ ] **6.4** Commit:

```bash
git add packages/action/src/index.ts
git commit -m "feat(action): wire analyzeProject/applyScope to annotations, job summary, and sticky comment"
```

### Step 7: Commit `dist/`, add CI freshness check

- [ ] **7.1** Edit `.gitignore` — add a negation right after the blanket `dist/` line:

```
node_modules/
dist/
!packages/action/dist/
*.log
```

- [ ] **7.2** Force-add the already-built `dist/` (built in Step 3.7/6.2):

```bash
git add -f packages/action/dist
git status --short packages/action/dist
```

Expected: files under `packages/action/dist` show as staged (`A`), not ignored.

- [ ] **7.3** In `.github/workflows/ci.yml`, in the `check` job, add a step right after the existing `Build packages` step:

```yaml
      - name: Verify action dist is up to date
        run: git diff --exit-code -- packages/action/dist
```

- [ ] **7.4** Verify locally — rebuild and confirm no diff (proves the committed `dist/` matches source):

```bash
pnpm --filter @svelte-vitals/action build
git diff --exit-code -- packages/action/dist; echo "exit: $?"
```

Expected: exit 0, no output (dist unchanged by the rebuild).

- [ ] **7.5** Commit:

```bash
git add .gitignore packages/action/dist .github/workflows/ci.yml
git commit -m "chore(action): commit dist/ and verify its freshness in CI"
```

### Step 8: Build-time SHA-pin codegen (`packages/cli`)

- [ ] **8.1** Create `packages/cli/scripts/gen-action-pin.mjs`:

```js
#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const cliDir = join(scriptsDir, '..');
const actionPkgPath = join(cliDir, '..', 'action', 'package.json');
const outPath = join(cliDir, 'src', 'ci', 'action-pin.generated.ts');

function resolveActionPin() {
  try {
    const sha = execSync('git rev-parse HEAD', { cwd: cliDir, encoding: 'utf8' }).trim();
    const actionPkg = JSON.parse(readFileSync(actionPkgPath, 'utf8'));
    return { sha, version: actionPkg.version };
  } catch {
    // Not a git checkout (e.g. an extracted npm tarball) — never happens for a real
    // build/release, only in exotic local scenarios. Fall back to an obviously-fake pin.
    return { sha: '0'.repeat(40), version: '0.0.0' };
  }
}

const { sha, version } = resolveActionPin();
writeFileSync(
  outPath,
  `// Generated by scripts/gen-action-pin.mjs — do not edit by hand.\n` +
    `export const ACTION_SHA = '${sha}';\n` +
    `export const ACTION_VERSION = '${version}';\n`
);
```

- [ ] **8.2** Update `packages/cli/package.json`'s scripts:

```json
  "scripts": {
    "build": "node scripts/gen-action-pin.mjs && tsup",
    "typecheck": "node scripts/gen-action-pin.mjs && tsc --noEmit",
    "test": "node scripts/gen-action-pin.mjs && vitest run"
  },
```

- [ ] **8.3** Add the generated file to `.gitignore` (it's build-time codegen output, like every other package's `dist/`):

```
packages/cli/src/ci/action-pin.generated.ts
```

- [ ] **8.4** Verify the script runs and produces a sane file:

```bash
node packages/cli/scripts/gen-action-pin.mjs
cat packages/cli/src/ci/action-pin.generated.ts
```

Expected: a 40-hex-char `ACTION_SHA` (the current `HEAD`) and `ACTION_VERSION` equal to `packages/action/package.json`'s `"version"` (`0.1.0` per Step 3.1).

- [ ] **8.5** Commit:

```bash
git add packages/cli/scripts/gen-action-pin.mjs packages/cli/package.json .gitignore
git commit -m "feat(cli): embed the action's SHA+version at build time for ci install"
```

### Step 9: Rewrite the `ci install` template

- [ ] **9.1** Rewrite `packages/cli/src/ci/workflow.ts` in full:

```ts
export const WORKFLOW_PATH = '.github/workflows/svelte-vitals.yml';

export interface WorkflowPlan {
  status: 'created' | 'exists' | 'updated';
  content?: string;
}

/**
 * Decide what to do with the generated workflow file, mirroring the `install` wizard's
 * WriteStatus convention: no existing file → 'created'; an existing file with no
 * --force → 'exists' (left untouched, idempotent re-runs); --force → 'updated'.
 * Content generation is the caller's job (`ci/cli.ts`) — this function only decides.
 */
export function planWorkflowWrite(existing: string | undefined, force: boolean): WorkflowPlan {
  if (existing === undefined) return { status: 'created' };
  if (!force) return { status: 'exists' };
  return { status: 'updated' };
}

/**
 * Build the short GitHub Actions workflow that calls `@svelte-vitals/action` (issue #154 —
 * replaces the old ~60-line inline template; see plans/020-reusable-github-action.md).
 * The action itself owns annotations, the job summary, the sticky PR comment, and the
 * gate — `ci install` only scaffolds the call, pinned to a commit SHA with a same-line
 * version comment (matching this repo's own `actions/checkout@<sha> # v4` convention).
 */
export function buildWorkflowYaml(opts: { actionSha: string; actionVersion: string }): string {
  const { actionSha, actionVersion } = opts;
  return [
    '# Generated by `svelte-vitals ci install`.',
    '# Re-run with --force to regenerate.',
    'name: svelte-vitals',
    '',
    'on:',
    '  pull_request:',
    '',
    'permissions:',
    '  contents: read',
    '  pull-requests: write',
    '',
    'jobs:',
    '  svelte-vitals:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '        with:',
    '          fetch-depth: 0',
    `      - uses: oekazuma/svelte-vitals/packages/action@${actionSha} # @svelte-vitals/action@${actionVersion}`,
    '        with:',
    '          diff: origin/${{ github.base_ref }}',
    '          baseline: origin/${{ github.base_ref }}',
    ''
  ].join('\n');
}
```

- [ ] **9.2** Rewrite `packages/cli/src/ci/cli.ts`'s help text and the `buildWorkflowYaml` call site:

```ts
import { join } from 'node:path';
import mri from 'mri';
import type { InstallIO } from '../install/index.js';
import { realIO } from '../install/cli.js';
import { WORKFLOW_PATH, buildWorkflowYaml, planWorkflowWrite } from './workflow.js';
import { ACTION_SHA, ACTION_VERSION } from './action-pin.generated.js';

const CI_HELP = `svelte-vitals ci — scaffold CI integration

Usage:
  svelte-vitals ci install [options]

Adds a GitHub Actions workflow (${WORKFLOW_PATH}) that calls the \`@svelte-vitals/action\`
GitHub Action on pull requests: inline annotations, a job summary, and a sticky PR
comment with the findings.

Options:
  --force       Overwrite an existing workflow file
  --dry-run     Print the plan and exit without writing
  -h, --help    Show this help`;

/** Parse `ci` args, print diagnostics, and run the requested subcommand. Returns the exit code. */
export async function runCiCli(args: string[], io: InstallIO = realIO()): Promise<number> {
  const sub = args[0];

  if (sub === '--help' || sub === '-h') {
    io.log(CI_HELP);
    return 0;
  }
  if (sub !== 'install') {
    io.log(CI_HELP);
    return 2;
  }

  const argv = mri(args.slice(1), {
    boolean: ['force', 'dry-run', 'help'],
    alias: { h: 'help' }
  });
  if (argv.help) {
    io.log(CI_HELP);
    return 0;
  }

  const path = join(io.cwd, WORKFLOW_PATH);
  const existing = io.readFile(path);
  const plan = planWorkflowWrite(existing, Boolean(argv.force));

  io.log('Plan:');
  io.log(`  ${WORKFLOW_PATH}  [${plan.status}]`);

  if (argv['dry-run']) {
    io.log('Dry run — no files written.');
    return 0;
  }

  if (plan.status === 'exists') {
    io.log(`= already installed (${WORKFLOW_PATH}) — use --force to regenerate.`);
  } else {
    try {
      io.writeFile(path, buildWorkflowYaml({ actionSha: ACTION_SHA, actionVersion: ACTION_VERSION }));
      io.log(`✓ ${plan.status} ${WORKFLOW_PATH}`);
    } catch (err) {
      io.errorLog(
        `svelte-vitals: failed to write ${WORKFLOW_PATH}: ${err instanceof Error ? err.message : String(err)}`
      );
      return 2;
    }
  }

  io.log('Done. Commit the workflow file and open a PR to see it in action.');
  return 0;
}
```

- [ ] **9.3** Rewrite `packages/cli/test/ci/workflow.test.ts` in full:

```ts
import { describe, it, expect } from 'vitest';
import { WORKFLOW_PATH, buildWorkflowYaml, planWorkflowWrite } from '../../src/ci/workflow.js';

describe('planWorkflowWrite', () => {
  it('reports created when no file exists', () => {
    expect(planWorkflowWrite(undefined, false)).toEqual({ status: 'created' });
  });
  it('reports exists when a file exists and force is false', () => {
    expect(planWorkflowWrite('existing content', false)).toEqual({ status: 'exists' });
  });
  it('reports updated when a file exists and force is true', () => {
    expect(planWorkflowWrite('existing content', true)).toEqual({ status: 'updated' });
  });
  it('reports created (not updated) when no file exists even with force', () => {
    expect(planWorkflowWrite(undefined, true)).toEqual({ status: 'created' });
  });
});

describe('WORKFLOW_PATH', () => {
  it('points at the standard GitHub Actions workflow location', () => {
    expect(WORKFLOW_PATH).toBe('.github/workflows/svelte-vitals.yml');
  });
});

describe('buildWorkflowYaml', () => {
  const sha = 'a'.repeat(40);
  const yaml = buildWorkflowYaml({ actionSha: sha, actionVersion: '1.2.3' });

  it('checks out full history (fetch-depth: 0) so diff/baseline can resolve the base ref', () => {
    expect(yaml).toContain('fetch-depth: 0');
  });

  it('calls the action pinned to a commit SHA with a same-line version comment', () => {
    expect(yaml).toContain(`uses: oekazuma/svelte-vitals/packages/action@${sha} # @svelte-vitals/action@1.2.3`);
  });

  it('passes diff and baseline scoped to the PR base ref', () => {
    expect(yaml).toContain('diff: origin/${{ github.base_ref }}');
    expect(yaml).toContain('baseline: origin/${{ github.base_ref }}');
  });

  it('does not scaffold a setup-node step (the action runs on node24 directly)', () => {
    expect(yaml).not.toContain('setup-node');
    expect(yaml).not.toContain('npx');
  });

  it('does not scaffold an inline github-script sticky-comment step (owned by the action now)', () => {
    expect(yaml).not.toContain('github-script');
    expect(yaml).not.toContain('actions/github-script');
  });

  it('contains no tab characters (YAML indentation must be spaces)', () => {
    expect(yaml).not.toContain('\t');
  });
});
```

- [ ] **9.4** `packages/cli/test/ci/cli.test.ts` needs no edits: its only content-dependent assertion, `expect(writes[PATH]).toContain('name: svelte-vitals')`, still holds — the new template still starts with `name: svelte-vitals`. Every other assertion in that file checks status/log text (`created`, `exists`, `Dry run`, `Done.`), not YAML content, so it's unaffected by the template rewrite.

- [ ] **9.5** Regenerate the pin file and run the CLI test suite:

Run: `node packages/cli/scripts/gen-action-pin.mjs && pnpm --filter svelte-vitals test`
Expected: all tests pass, including the rewritten `workflow.test.ts` and unchanged `cli.test.ts`.

- [ ] **9.6** Build and typecheck:

Run: `pnpm --filter svelte-vitals build && pnpm --filter svelte-vitals typecheck`
Expected: both exit 0.

- [ ] **9.7** Manual verification — scaffold into a scratch directory and inspect the output:

```bash
node packages/cli/dist/bin.js ci install --dry-run
```

Expected: prints a `Plan:` preview; the printed plan doesn't include file content (that's fine — `--dry-run` only previews status, matching existing behavior). To see the actual generated YAML:

```bash
mkdir -p /tmp/svelte-vitals-ci-smoke && cd /tmp/svelte-vitals-ci-smoke
node <repo-abs-path>/packages/cli/dist/bin.js ci install
cat .github/workflows/svelte-vitals.yml
```

Expected: YAML containing `uses: oekazuma/svelte-vitals/packages/action@<40-hex-sha> # @svelte-vitals/action@0.1.0`, no `npx`/`setup-node`/`github-script`.

- [ ] **9.8** Commit:

```bash
git add packages/cli/src/ci/workflow.ts packages/cli/src/ci/cli.ts packages/cli/test/ci/workflow.test.ts packages/cli/test/ci/cli.test.ts
git commit -m "feat(cli): scaffold the @svelte-vitals/action call instead of the inline workflow"
```

### Step 10: Docs + `plans/README.md` + changesets

- [ ] **10.1** Rewrite `docs/src/content/docs/guides/ci.md`: replace every section describing the inline template's internals (setup-node, double scan, inline `github-script`) with a description of `@svelte-vitals/action`'s inputs (`path`, `diff`, `baseline`, `github-token`), its fork-PR behavior (annotations + summary still run, comment is skipped), and the new short `ci install` output. Keep the "hand-write it yourself" minimal-YAML section, updated to the new short form.

- [ ] **10.2** Apply the same rewrite to `docs/src/content/docs/ja/guides/ci.md` (same content, Japanese).

- [ ] **10.3** Verify docs build: `pnpm --filter docs check && pnpm --filter docs build` → both exit 0. If `docs-links.test.ts` fails, read the failure — it only checks rule docs, so guide-only changes shouldn't trip it, but confirm.

- [ ] **10.4** Update `plans/README.md`:
  - Add a row to the "Execution order & status" table:

  ```
  | 020 | `@svelte-vitals/action` — reusable GitHub Action replacing the inline `ci install` template | P1 | L | — | TODO |
  ```

  - In the "2026-07-08 のギャップ分析…で検討し、見送った項目" list, replace the line:

  ```
  - **GitHub Actions の marketplace Action 化**: v1 は `npx` 直叩きテンプレート(Plan 015)で十分。テンプレートの複雑さが限界を迎えたら再検討。
  ```

  with:

  ```
  - **GitHub Actions の marketplace Action 化**: issue #154 で実際に限界を踏んだ報告を受け、Plan 020 で着手(`@svelte-vitals/action`、設計は `docs/superpowers/specs/2026-07-09-github-action-design.md`)。
  ```

- [ ] **10.5** Create changesets:

```bash
pnpm changeset
```

Select `svelte-vitals` (minor — `ci install` now scaffolds a different template) and `@svelte-vitals/action` (minor — first release). Write summaries in English, no benchmark-tool names.

- [ ] **10.6** Commit:

```bash
git add docs/src/content/docs/guides/ci.md docs/src/content/docs/ja/guides/ci.md plans/README.md .changeset
git commit -m "docs: document @svelte-vitals/action and update ci install guide (en/ja)"
```

### Step 11: Full verification pass

- [ ] **11.1** Run everything from a clean state:

```bash
pnpm build && pnpm typecheck && pnpm test && pnpm lint
```

Expected: all exit 0. This exercises Step 7's new CI dist-freshness check locally too (`pnpm build` rebuilds `packages/action`; if `dist/` drifted from source, `pnpm lint`/CI's dedicated step catches it — run `git diff --exit-code -- packages/action/dist` yourself here as an extra local check).

- [ ] **11.2** Run `pnpm check:publish` and confirm `@svelte-vitals/action` is **not** included in its output (it should only mention `@svelte-vitals/core`, `@svelte-vitals/vite`, `svelte-vitals`, `@svelte-vitals/mcp`).

- [ ] **11.3** Update the Status row for Plan 020 in `plans/README.md` from `TODO` to `DONE` with a one-line summary (per this plan's header instructions), and update this plan's own `## Status` section at the top if anything deviated from the design.

## Test plan

Covered inline per step: `apply-scope.test.ts` (Step 2), `fork.test.ts` / `sticky-comment.test.ts` (Steps 4-5), `workflow.test.ts` rewrite (Step 9), existing `run-diff.test.ts`/`run-baseline.test.ts`/`cli.test.ts` regression (unchanged, must stay green throughout). The action's `src/index.ts` entrypoint is manually smoke-tested (Step 6.3), not unit-tested — same philosophy as the install wizard's clack adapter.

## Done criteria

- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` all exit 0
- [ ] `packages/action/dist` is committed and CI's `check` job fails if it drifts from source
- [ ] `svelte-vitals ci install` (fresh, in a scratch dir) generates a workflow calling `oekazuma/svelte-vitals/packages/action@<sha> # @svelte-vitals/action@<version>`, with `fetch-depth: 0`, no `npx`/`setup-node`/`github-script`
- [ ] `applyScope` is exported from `svelte-vitals` and covered by its own tests; `run()`'s existing diff/baseline tests are unchanged and green
- [ ] `docs/src/content/docs/guides/ci.md` and `ja/guides/ci.md` both describe the Action, not the old inline template
- [ ] `@svelte-vitals/action` is excluded from `check:publint`/`check:types`
- [ ] Changesets exist for `svelte-vitals` and `@svelte-vitals/action`
- [ ] `plans/README.md` row for 020 updated; backlog note for "marketplace Action 化" updated

## STOP conditions

- Step 2's drift check (top of this plan) finds `packages/cli/src/index.ts:296-341` no longer matches the described block.
- `packages/core` needs a `node:` import or I/O to make this work — the design is wrong; stop and report (should not happen — no core changes in this plan).
- You find yourself wanting to add a floating `v0`/`v1` major tag or `fail-on`/`min-health` action inputs — these were explicitly declined/deferred in the design doc; stop and report instead of improvising them in.
- A verification command fails twice in a row after one fix attempt.

## Maintenance notes

- `ACTION_SHA`/`ACTION_VERSION` (Step 8) reflect whatever `packages/action/package.json` and `HEAD` were at `svelte-vitals`'s last build. If `packages/action` released more recently than the last `svelte-vitals` release, `ci install` users get a slightly older (but always valid — dist freshness is CI-enforced) pin until the next `svelte-vitals` release. This is expected, not a bug — see design doc §5 for the full reasoning.
- If a future change adds action inputs (`fail-on`, `min-health`, outputs), update `packages/action/action.yml`, `src/index.ts`, and both `ci.md`/`ja/ci.md` together.
- The design doc (`docs/superpowers/specs/2026-07-09-github-action-design.md`) has a "Correction from the original draft" note in §3 recording that `analyzeProject` doesn't accept `diffBase`/`baseline` directly — read that before assuming the action calls it with those options.
