# Reusable GitHub Action for CI integration

**Date:** 2026-07-09
**Status:** Approved (pending user review of this doc)
**Packages:** new `@svelte-vitals/action` (`packages/action`, private), `svelte-vitals` (`ci install` template + build-time codegen), `@svelte-vitals/core` (no code change — reporters reused as-is)

## Context

[Issue #154](https://github.com/oekazuma/svelte-vitals/issues/154): `svelte-vitals ci install` (Plan 015) scaffolds a full, self-contained GitHub Actions workflow (`.github/workflows/svelte-vitals.yml`, ~60 lines) directly into the consumer's repo — checkout, Node setup, two `npx -y svelte-vitals@<version>` invocations, an inline `actions/github-script` sticky-comment block, and a gate step. The reporter noted three concrete problems:

1. The generated workflow doesn't match repos with their own CI conventions (SHA-pinned actions, a shared `setup-node` composite action, `pnpm` instead of `npx`) — every `ci install` user ends up hand-rewriting most of it.
2. The CLI version is a literal string inside two `run:` shell blocks. There's no way for Dependabot/Renovate to bump it, and re-running `ci install --force` clobbers any local edits.
3. The sticky-comment `github-script` logic becomes "our code" that every consumer repo now owns, reviews, and maintains.

`plans/README.md`'s 2026-07-08 gap analysis explicitly deferred this: _"GitHub Actions の marketplace Action 化: v1 は `npx` 直叩きテンプレート(Plan 015)で十分。テンプレートの複雑さが限界を迎えたら再検討"_ ("defer until the template's complexity hits its limit"). Issue #154 is a real-world report of exactly that limit.

## Goal

Ship `packages/action` as a reusable, first-party GitHub Action that a consumer references as:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- uses: oekazuma/svelte-vitals/packages/action@<sha> # @svelte-vitals/action@0.1.0
  with:
    diff: origin/${{ github.base_ref }}
    baseline: origin/${{ github.base_ref }}
```

instead of owning ~60 lines of generated YAML. `ci install` keeps scaffolding this short call (it remains the friendly zero-config entry point — issue ask #5) but no longer expands the Action's internals into the consumer's repo.

## Decisions (settled during brainstorming)

1. **Hosting: same monorepo, new subpackage** `packages/action` (`@svelte-vitals/action`, `"private": true`), not a separate `oekazuma/svelte-vitals-action` repo. Referenced via GitHub's subpath syntax: `uses: owner/repo/packages/action@ref`.
2. **Implementation: a JS action**, not composite/Docker. Bundled via tsup into a single `dist/index.js`; `action.yml` uses `runs: { using: 'node24', main: 'dist/index.js' }`. Runs in-process — imports `analyzeProject`/`buildRulesConfig` from `svelte-vitals` and reporter/summary helpers from `@svelte-vitals/core`, the same pattern `packages/mcp` already uses (`packages/mcp/src/tools/analyze.ts`). No `npx`, no subprocess, no second scan pass.
3. **`dist/` is committed normally** (not gitignored) for this package only, matching the official `actions/typescript-action` template convention. CI's `check` job gets a step verifying it's up to date (`git diff --exit-code -- packages/action/dist` after the existing `pnpm build`). No release-time build-and-commit choreography needed.
4. **Versioning: changesets-native tags only.** `packages/action` is a normal changesets-versioned package; its releases produce tags shaped like every other package's (`@svelte-vitals/action@0.1.0`), same as the 87 existing tags. No separate floating `v0`/`v1` major tag — considered and declined, since Dependabot tracks arbitrary ref bumps on a pinned action regardless of tag naming, so the extra moving-tag machinery buys nothing here.
5. **`ci install` is replaced, not dual-tracked.** `buildWorkflowYaml` stops generating the full inline template and instead emits the short Action-call form above. No `--template=inline|action` flag. Already-installed consumer workflows are untouched until they re-run with `--force`.
6. **Action reference is commit-SHA-pinned with a same-line version comment**, matching this repo's own convention (`actions/checkout@9c091bb2... # v7.0.0` in `.github/workflows/ci.yml`): `uses: oekazuma/svelte-vitals/packages/action@<40-hex-sha> # @svelte-vitals/action@<version>`. The SHA is resolved at `svelte-vitals` CLI **build time**, not at `ci install` runtime — see Design §5. This keeps `ci install` fully offline (no GitHub API/network call), consistent with its current behavior. Scope note: only _our_ action reference gets SHA-pinned by this change; `actions/checkout@v4` in the generated template keeps its existing floating-tag form (unchanged from today's template) — SHA-pinning third-party actions in generated output is a separate, broader concern issue #154 didn't raise.

## Design

### 1. Package layout

```
packages/action/
  action.yml
  src/
    index.ts        // entrypoint: @actions/core wiring, calls analyzeProject, orchestrates the rest
    fork.ts          // pure: isForkPR(context-like shape) -> boolean
    sticky-comment.ts // pure: given existing comments + marker + body -> {op: 'create'|'update', id?} ; octokit call is a thin wrapper in index.ts
    gate.ts           // pure: given analyze result -> pass/fail
  dist/               // committed (see Decision 3)
  package.json        // "private": true
  tsup.config.ts
  tsconfig.json
packages/action/test/
  fork.test.ts
  sticky-comment.test.ts
  gate.test.ts
```

`package.json` dependencies: `svelte-vitals` (workspace:\*) for `analyzeProject`/`buildRulesConfig`; `@svelte-vitals/core` (workspace:\*) for `formatMarkdownReport`/`formatGithubReport`/`computeHealth`/`summarize`/`docsUrlFor`; `@actions/core` and `@actions/github` added to the pnpm `catalog:` (per AGENTS.md — shared devDependency-style versions live in `pnpm-workspace.yaml`, not literal versions in the package).

Excluded from `check:publish` (`check:publint`/`check:types` in root `package.json`) — those validate npm-publishable packages; `@svelte-vitals/action` is never published to npm, only released as git tags. It's still built/typechecked/tested normally via the existing `pnpm -r build`/`typecheck`/`test` scripts (no special-casing needed there).

### 2. `action.yml` inputs

| Input          | Maps to                             | Default               |
| -------------- | ----------------------------------- | --------------------- |
| `path`         | `analyzeProject`'s cwd              | `.`                   |
| `diff`         | `AnalyzeOptions.diffBase`           | (unset)               |
| `baseline`     | `AnalyzeOptions.baseline`           | (unset)               |
| `github-token` | octokit auth for the sticky comment | `${{ github.token }}` |

No `reporter` input — the action always produces all three outputs (annotations + job summary + sticky comment) internally; that fan-out is no longer the consumer's concern. No `fail-on`/`min-health` inputs in v1 — the current inline template doesn't expose them either (default critical-only gate); adding them is a straightforward follow-up, not required to match today's behavior (YAGNI).

### 3. Runtime behavior (`src/index.ts`)

**Correction from the original draft:** `analyzeProject` does not accept `diffBase`/`baseline` — those are resolved by a ~40-line sequence inside the CLI's `run()` (`packages/cli/src/index.ts:298-341`: `getChangedFiles`/`filterToChangedFiles` for `--diff`/`--staged`, `checkoutBaseline`/`filterToNewFindings` for `--baseline`), none of which is currently exported from the `svelte-vitals` package. Rather than duplicate that sequence in `packages/action`, extract it into a new exported function, **`applyScope(results, opts): Promise<Result[]>`**, added to `packages/cli/src/index.ts`'s export list — a behavior-preserving refactor (`run()` calls it instead of inlining the block; existing `run()` tests must pass unchanged). The action then does:

```ts
const analysis = await analyzeProject({ cwd: path });
const results = await applyScope(analysis.results, {
  cwd: path,
  diffBase: diffInput,
  baseline: baselineInput,
  errorLog: core.warning,
  analyzeOpts: {} // no CLI flags exposed by the action beyond path/diff/baseline (v1)
});
```

then, from that single `results` array:

1. **Annotations** — reuse `formatGithubReport`'s per-finding formatting (or emit equivalent `::error file=...::` lines) to stdout; GitHub parses workflow commands from any step's stdout, not just `@actions/core` calls.
2. **Job summary** — `formatMarkdownReport(results, config, { version })` written via `core.summary.addRaw(...).write()`.
3. **Sticky PR comment** — same Markdown string, posted via `@actions/github`'s octokit using the existing `<!-- svelte-vitals-report -->` marker find/update/create logic (ported from the current `github-script` block, decision logic in `sticky-comment.ts` kept pure/testable). Skipped when `fork.ts#isForkPR` is true — same behavior PR #144 already established for the inline template (fork PRs get a read-only `GITHUB_TOKEN`; annotations and job summary still run).
4. **Gate** — `core.setFailed(...)` when the result has a qualifying critical finding, decided by the pure `gate.ts` (mirrors the CLI's current exit-code-1 semantics) rather than shelling out and checking a step's `outcome`.

This collapses the current "run twice" duplication (one scan for `--reporter github`, one for `--reporter md`) into one in-process call producing all outputs.

### 4. `dist/` commit convention & CI check

`packages/action/dist/` is tracked in git (only exception to the repo's usual gitignored-`dist/` convention). `.github/workflows/ci.yml`'s `check` job gets one more step, right after the existing `Build packages` step:

```yaml
- name: Verify action dist is up to date
  run: git diff --exit-code -- packages/action/dist
```

Since `pnpm build` (already run earlier in that job) rebuilds every workspace package including `packages/action`, this step fails the build if a contributor changed `packages/action/src` without regenerating and committing `dist/` — exactly the `actions/typescript-action` template's own CI pattern.

### 5. Build-time SHA-pin codegen (`packages/cli`)

`packages/cli`'s `build` and `test` npm scripts both first run a small script (`packages/cli/scripts/gen-action-pin.mjs`) that writes `packages/cli/src/ci/action-pin.generated.ts`:

```ts
export const ACTION_SHA = '<git rev-parse HEAD>';
export const ACTION_VERSION = '<packages/action/package.json version>';
```

This file is gitignored (pure codegen output, like every other package's `dist/`). Package.json:

```jsonc
"scripts": {
  "build": "node scripts/gen-action-pin.mjs && tsup",
  "test": "node scripts/gen-action-pin.mjs && vitest run"
}
```

**Why `git rev-parse HEAD` is safe to embed:** `.github/workflows/release.yml` checks out the post-merge "Version Packages" commit and runs `pnpm build` (which builds `svelte-vitals`, running this codegen) _before_ `changesets/action` tags and publishes whatever packages changed in that release, all pointing at that same `HEAD`. Two cases:

- `packages/action` has a pending changeset in this release → the embedded SHA **is** the exact commit `@svelte-vitals/action@<new-version>` gets tagged at.
- `packages/action` has no pending changeset (CLI-only release) → `HEAD` is a later commit than the action's last real release tag, but Decision 3's CI check guarantees `packages/action/dist` at `HEAD` is byte-identical to that last release (nothing could have changed it without the freshness check failing), so pinning to the newer `HEAD` SHA is still functionally correct — it just means the embedded SHA doesn't literally equal the old tag's SHA, only its content. `ACTION_VERSION` (read directly from `packages/action/package.json` at build time) stays accurate as the comment either way.

Local/PR builds embed whatever `HEAD` is at build time (possibly an unpushed branch commit) — harmless, since only the release job's build is ever published to npm; a contributor testing `ci install` from a dev build simply sees a pin reflecting their local checkout.

### 6. `ci install` / `workflow.ts` changes

`buildWorkflowYaml`'s signature changes from `{ version: string }` (the CLI's own version, no longer needed here) to `{ actionSha: string; actionVersion: string }`, sourced from `action-pin.generated.ts` instead of `readPackageVersion()`. Output shrinks to:

```yaml
# Generated by `svelte-vitals ci install`.
# Re-run with --force to regenerate.
name: svelte-vitals

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  svelte-vitals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: oekazuma/svelte-vitals/packages/action@<ACTION_SHA> # @svelte-vitals/action@<ACTION_VERSION>
        with:
          diff: origin/${{ github.base_ref }}
          baseline: origin/${{ github.base_ref }}
```

No `actions/setup-node` step (the JS action runs directly on the runner via `node24`, no consumer Node setup required). `planWorkflowWrite`'s created/exists/updated logic is unchanged.

### 7. Docs impact

- `docs/src/content/docs/guides/ci.md` (+ `ja/`): rewritten around the Action — its inputs, fork-PR behavior, what `ci install` now generates, and a note for existing `ci install` users that re-running with `--force` migrates them to the new template (no automatic migration/detection — same `exists`/`--force` flow as today).
- `plans/README.md`'s "見送った項目" line for marketplace Action 化 gets updated to point at this plan once implemented.

### 8. Testing

- `packages/action/test/`: `fork.test.ts` (fork vs. same-repo PR shapes), `sticky-comment.test.ts` (create/update decision given existing comment lists, marker matching), `gate.test.ts` (pass/fail given analyze results). The `@actions/core`/`@actions/github` wiring in `index.ts` is a thin adapter, exercised by hand rather than unit-tested — same philosophy already applied to the clack-backed `InstallPrompts` adapter in the install wizard.
- `packages/cli/test/ci/workflow.test.ts`: rewritten for the new short template — asserts the `uses:` line's shape (owner/repo/packages/action@sha # version comment), `fetch-depth: 0`, no `setup-node`/`npx` references.
- `pnpm build && pnpm typecheck && pnpm test && pnpm lint` green, including the new `check` job dist-freshness step.

### 9. Out of scope (YAGNI / deferred)

- `fail-on`/`min-health` inputs on the action (not in the current inline template either).
- Action `outputs:` (e.g. health score) for downstream steps to consume.
- A floating `v0`/`v1` major tag (Decision 4).
- GitLab CI / other non-GitHub-Actions templates.
- Automatic migration/detection of the old inline-template workflow shape — `--force` covers it.
- Making `packages/action` npm-publishable.

## Migration / rollout notes

Existing `ci install`-generated workflows (the old ~60-line inline template) are not touched by this change unless the user re-runs `ci install --force`. No breaking change to already-installed consumer repos.
