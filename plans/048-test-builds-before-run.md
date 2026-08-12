# Plan 048: Make `pnpm test` immune to a stale `dist/` (build before the recursive test run)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ddcf62d0..HEAD -- package.json AGENTS.md CONTRIBUTING.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW — the only behavior change is that `pnpm test` now always
  builds first; no test logic changes.
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `ddcf62d0`, 2026-08-12

## Why this matters

`packages/cli`'s tests import `@svelte-vitals/core` through its published
`exports` map, which points at `./dist/index.js` — the **built** output, not
the source. Root `pnpm test` is `pnpm -r test` with no build step, so on a
checkout whose `dist/` predates a recent core export (the audit reproduced
this with a pre-PR-#463 dist: **16 failed test files / 136 failed tests**,
all `TypeError: resolveRepoLocalPath is not a function`), a contributor or a
plan-executing agent sees a wall of failures unrelated to their change. The
inverse is worse and silent: a stale dist that still happens to export
everything lets the suite pass against yesterday's core. CI is unaffected
(it builds before testing), which is exactly why this trap only fires on
local machines and in agent sessions — including the executors of the other
plans in this directory.

## Current state

- `package.json` (repo root) — the scripts block:

  ```json
  "scripts": {
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
  ```

  (`package.json:6-8`; `"test"` has no build dependency.)

- `packages/core/package.json:34-39` — the exports map that makes tests bind
  to dist:

  ```json
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  ```

- `AGENTS.md:11-19` — the "Verify commands" table lists
  `Test | pnpm test | pnpm -r test (vitest)`. After this change the Notes
  cell should say the build now runs first.
- CI (`.github/workflows/ci.yml`) builds or cache-restores `dist` before
  running `pnpm test`, so CI never hits the trap; after this change the CI
  `test` job will run a (redundant but correct) build. That cost is
  accepted — see Maintenance notes.

## Commands you will need

| Purpose | Command        | Expected on success |
| ------- | -------------- | ------------------- |
| Install | `pnpm install` | exit 0              |
| Build   | `pnpm build`   | exit 0              |
| Test    | `pnpm test`    | exit 0, all pass    |
| Lint    | `pnpm lint`    | exit 0              |

## Scope

**In scope** (the only files you should modify):

- `package.json` (repo root) — the `test` script line only
- `AGENTS.md` — the one Notes cell for the Test row
- `CONTRIBUTING.md` — only if it states that `pnpm test` needs a prior build
  (it currently does not; check before editing)

**Out of scope** (do NOT touch, even though they look related):

- `packages/core/package.json` `exports` — adding a `development` condition
  so vitest binds to `src/` is a real alternative, but it changes how every
  test in the repo resolves core and is a maintainer design decision. Do not
  attempt it here.
- `.github/workflows/ci.yml` — the redundant build in the `test` job is
  accepted; do not "optimize" the workflow in this plan.
- Any vitest config.

## Git workflow

- Branch: `advisor/048-test-builds-before-run`
- Conventional commits, scoped by package; this is a root-level change, use
  the `chore:` prefix (matching e.g. `chore(cli): stop exporting four
internal-only types` from `git log`): `chore: build before the recursive
test run so a stale dist can't fail or fake the suite`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Change the root test script

In root `package.json`, change:

```json
"test": "pnpm -r test",
```

to:

```json
"test": "pnpm build && pnpm -r test",
```

**Verify**: `grep -n '"test"' package.json` → the line shows
`"pnpm build && pnpm -r test"`.

### Step 2: Prove the trap is closed

Simulate a stale dist and confirm `pnpm test` recovers on its own:

```bash
rm -rf packages/core/dist
pnpm test
```

**Verify**: exit 0, all tests pass (the build step recreates
`packages/core/dist` before any test imports it).

### Step 3: Update AGENTS.md's verify table

In `AGENTS.md`, the Test row currently reads:

`| Test | pnpm test | pnpm -r test (vitest) |`

Change the Notes cell to: `pnpm build && pnpm -r test (vitest) — builds
first because packages/cli's tests import @svelte-vitals/core from its built
dist`.

**Verify**: `grep -n 'pnpm -r test' AGENTS.md` → the row includes the new
wording.

### Step 4: Changeset decision

This is an internal-only change to a private root manifest — **no changeset**
(per AGENTS.md: "Internal-only / doc-only changes don't need one"). Do not
run `pnpm changeset`.

## Test plan

No new test files. Step 2 is the regression proof: deleting
`packages/core/dist` and running `pnpm test` must succeed end to end.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -c 'pnpm build && pnpm -r test' package.json` → `1`
- [ ] `rm -rf packages/core/dist && pnpm test` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `git status` shows only in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Root `package.json`'s `test` script is no longer exactly `"pnpm -r test"`
  (someone else already changed it).
- Step 2 fails for a reason other than a missing dist (i.e. real test
  failures at HEAD) — the baseline is broken and this plan can't verify.
- You feel the need to touch `packages/core/package.json` or any vitest
  config — that is the out-of-scope alternative design.

## Maintenance notes

- The CI `test` job now builds twice in effect (cache-restore/build step +
  the build inside `pnpm test`). If CI time becomes a concern, the right fix
  is a `development` export condition on core/cli plus
  `resolve.conditions` in the vitest configs — recorded here as the
  deliberately deferred alternative, not something to bolt on later without
  design review.
- Any future package whose tests import a sibling's built `dist` inherits
  this protection automatically; nothing per-package to remember.
