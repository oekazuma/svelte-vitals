# Plan 054: Harden the scaffolded CI workflow — `persist-credentials: false` and re-synced checkout pin

## Status

- **Priority**: P1 / **Effort**: S / **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: main `f4b33ba9`, 2026-08-12 (finding 260812-SEC-03)

## Why this matters

`ci install` scaffolds `.github/workflows/svelte-vitals.yml` into OTHER people's repos. The generated checkout has no `persist-credentials: false`, so the job token stays readable in `.git/config` while a `pull_request`-triggered job runs with `pull-requests: write` declared — this repo applied exactly that hardening to its own checkouts (PR #412) but the template was missed. Separately, the template pins `actions/checkout` at v7.0.0 while this repo's own workflows all pin `3d3c42e5… # v7.0.1`; the code comment claims "Kept in lockstep" — the code has drifted from its own stated invariant, and a test locks the stale value in.

## Current state

- `packages/cli/src/ci/workflow.ts` (verified at `f4b33ba9`):

  ```ts
  // Kept in lockstep with the pin this repo's own workflows use (.github/workflows/ci.yml,
  // release.yml, deploy-docs.yml) — bump both together when actions/checkout cuts a new release.
  const CHECKOUT_SHA = '9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0';
  const CHECKOUT_VERSION = 'v7.0.0';
  ```

  and in `buildWorkflowYaml`:

  ```ts
  `      - uses: actions/checkout@${CHECKOUT_SHA} # ${CHECKOUT_VERSION}`,
  '        with:',
  '          fetch-depth: 0',
  ```

- This repo's own pin (`.github/workflows/ci.yml:29` and all other checkouts): `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`.
- A CLI test asserts the generated YAML — find it with `grep -rn '9c091bb2' packages/cli/test/` (the audit located the assertion in `packages/cli/test/ci/cli.test.ts`; trust the grep over the line number).
- `fetch-depth: 0` already fetches all branches, so `origin/${{ github.base_ref }}` (the `diff`/`baseline` inputs to the action) resolves locally without credentials — `persist-credentials: false` does not break the scaffolded flow.

## Commands you will need

| Purpose   | Command          | Expected |
| --------- | ---------------- | -------- |
| Install   | `pnpm install`   | exit 0   |
| Build     | `pnpm build`     | exit 0   |
| Typecheck | `pnpm typecheck` | exit 0   |
| Tests     | `pnpm test`      | all pass |
| Lint      | `pnpm lint`      | exit 0   |

## Scope

**In scope**:

- `packages/cli/src/ci/workflow.ts`
- the CLI test(s) asserting the generated YAML (found via the grep above)
- one NEW test file or test case asserting pin lockstep (see Step 3)
- `.changeset/<new>.md` (create)

**Out of scope**: `.github/workflows/*.yml` (this repo's own workflows are already correct — do not touch), `packages/cli/src/ci/upgrade.ts` (`ci upgrade` rewrites only the ACTION pin line, not the checkout line — widening it is a separate decision), `action-pin.generated.ts`.

## Git workflow

- Branch: `advisor/054-scaffolded-workflow-hardening`
- Commit: `fix(cli): scaffold the CI workflow with persist-credentials false and the checkout pin this repo actually uses`
- Do NOT push or open a PR.

## Steps

### Step 1: Update the template

In `workflow.ts`: bump `CHECKOUT_SHA` to `3d3c42e5aac5ba805825da76410c181273ba90b1` and `CHECKOUT_VERSION` to `v7.0.1`, and add `persist-credentials: false` under the existing checkout `with:` block (alongside `fetch-depth: 0`).

**Verify**: `pnpm build && pnpm typecheck` → exit 0.

### Step 2: Update the YAML assertions

Fix the failing assertions found via `grep -rn '9c091bb2\|persist-credentials\|fetch-depth' packages/cli/test/` so they pin the NEW SHA, version comment, and the `persist-credentials: false` line.

**Verify**: `pnpm test` → all pass.

### Step 3: Enforce the lockstep comment

Add one test (in the same test file as Step 2's assertions, or a sibling) that reads `.github/workflows/ci.yml` from the repo root, extracts the first `actions/checkout@<sha> # <version>` occurrence, and asserts it equals `workflow.ts`'s `CHECKOUT_SHA`/`CHECKOUT_VERSION` (export them or regex them out of the generated YAML — exporting is cleaner). This turns the "Kept in lockstep" comment from aspiration into a red build on the next drift.

**Verify**: the new test passes; temporarily editing the test's expectation proves it CAN fail (revert the sabotage).

### Step 4: Changeset

Write `.changeset/<name>.md`: `svelte-vitals` **patch** — "`ci install`'s scaffolded workflow now sets `persist-credentials: false` on checkout and uses the same `actions/checkout` release this repo pins (v7.0.1). Existing workflows: re-run `svelte-vitals ci install --force` to regenerate."

**Verify**: `pnpm changeset status` parses.

## Done criteria

- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` all exit 0
- [ ] `grep -c '9c091bb2' packages/cli/src packages/cli/test -r` → 0
- [ ] Generated YAML (run the workflow-building test or `node -e` against dist) contains `persist-credentials: false` and `# v7.0.1`
- [ ] Lockstep test exists and reads the real `.github/workflows/ci.yml`
- [ ] Changeset exists (`svelte-vitals: patch`)
- [ ] `git status` shows only in-scope files modified

## STOP conditions

- `workflow.ts` no longer matches the excerpt.
- The lockstep test cannot locate `.github/workflows/ci.yml` from the test's cwd in a way that works under vitest — report the path problem rather than hardcoding an absolute path.
- Adding `persist-credentials: false` breaks any existing `ci upgrade` test (would mean upgrade's line-matching is tighter than expected — report, don't loosen the matcher).

## Maintenance notes

- Future checkout bumps in this repo's own workflows will now fail the lockstep test until `workflow.ts` is bumped too — that is the point; the fix is a two-line edit in `workflow.ts`.
- Deferred: teaching `ci upgrade` to also refresh the checkout line in already-scaffolded workflows (separate design decision, noted in the audit).
