# Separate the end-user Node floor from the development Node floor

**Date:** 2026-07-31
**Status:** Designed
**Packages:** none (CI + a root script). No published-package code changes, so no changeset.

> **Amendment (2026-08-17):** the floor moved from 22.13.0 to 24.16.0
> (`engines.node: >=24.16.0`, test matrix `24`/`26`, `floor-smoke` pinned to
> 24.16.0). The two-floor architecture below is unchanged, but every supported
> Node now strips TypeScript types natively, so the smoke's `.ts`-config check
> lost its old-Node branch and the CLI's guided `.ts`-config error was deleted
> with it. The script is now `scripts/floor-smoke.js` (the repo dropped `.mjs`
> extensions — every package is `"type": "module"`).

## Goal

Stop the development toolchain from dictating what Node version the published
packages can claim to support.

Today the repo declares the two floors separately —
`engines.node: >=22.13.0` on every published package (the end-user contract) and
`devEngines.runtime: 24.16.0` at the root (the development pin) — but CI ignores
the distinction: the `test (22.13.0)` matrix job runs `pnpm -r test`, which drags
vitest, jsdom, vite, and every other dev dependency onto the end-user floor. A dev
dependency that raises its own Node floor therefore breaks a job whose purpose has
nothing to do with that dependency.

## Why now

`jsdom@30` (PR #332) is the first dev dependency to cross the floor. Its only
breaking change is the Node requirement:

| Package                                                                                  | `engines.node`                         | On 22.13.0      |
| ---------------------------------------------------------------------------------------- | -------------------------------------- | --------------- |
| Runtime deps of the published packages (tinyglobby, mri, smol-toml, node-html-parser, …) | `>=12` – `>=22`                        | fine            |
| vite 8 / oxlint / oxfmt                                                                  | `^20.19.0 \|\| >=22.12.0`              | fine by 0.01    |
| vitest 4                                                                                 | `^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0`   | fine            |
| **jsdom 30**                                                                             | `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` | **unsatisfied** |

CI is green only because pnpm's `engine-strict` is off by default (no `.npmrc` in
this repo), so the mismatch is not even warned about — verified by grepping the
`test (22.13.0)` job log. The failure mode this sets up is a future jsdom (or
vite, or oxlint — both sit 0.01 above the floor) using an API newer than 22.13.0,
at which point one matrix job fails with a runtime error that has no visible
connection to the floor.

The three tests that would break first —
`packages/vite/test/app-shell-static.test.ts`,
`dashboard-script-staleness.test.ts`, `dashboard-script-ai-prompt.test.ts` — assert
the behaviour of the dev-overlay dashboard's **browser** client script. They say
nothing about whether the CLI runs on Node 22.13.0.

## What the floor job must not lose

`packages/cli/test/config-file.test.ts` branches on `process.versions.node`
(`nodeSupportsUnflaggedTypeStripping`) because native TypeScript type-stripping is
unflagged only from Node 22.18 / 23.6 — so on this repo's floor, 22.13–22.17 is the
one window where a `.ts` config file needs `--experimental-strip-types`. Moving the
test suite off 22.13.0 without replacement would silently drop the only execution of
that window.

Two things are worth separating here:

1. The existing child-process test asserts **Node's own** behaviour (a bare
   `import()` of a `.ts` file yields `ERR_UNKNOWN_FILE_EXTENSION` on old Node). It
   passes on every matrix entry via the branch, so it never _asserts_ which side it
   is on.
2. `loadConfigFile` catches that error and rethrows an actionable message
   ("upgrade Node to 22.18+, re-run with `--experimental-strip-types`, or rename the
   file to .mjs/.js" — `packages/cli/src/config-file.ts:263-271`). This branch is the
   actual end-user contract, and **no vitest test can ever reach it**: vitest's module
   runner transforms in-process dynamic `import()`, so a `.ts` config always loads
   inside vitest regardless of the host Node (recorded in the test's own comment).

So the floor job does not merely preserve coverage — it is the only place this
branch can be covered at all.

## Design

Three jobs with three distinct claims:

```
check                       build / typecheck / publint / attw                    (dev Node)
test (22, 24.16.0, 26)      pnpm -r test — vitest, jsdom, the lot — then           (dev Node line,
                             scripts/floor-smoke.mjs on the matrix Node             modern-Node branch)
floor-smoke (22.13.0)       built dist under bare `node`, no vitest                (end-user floor,
                                                                                     old-Node branch)
```

**`test` matrix becomes `['22', '24.16.0', '26']`.** Bare `'22'` resolves to the
latest 22.x, which satisfies jsdom and everything else, so the 22 line keeps full
unit-test coverage. The matrix now tracks _release lines_ the dev toolchain
supports, not the published floor.

**`floor-smoke` runs on 22.13.0** and asserts the end-user contract only, by
executing the built `dist` with a bare `node` — never through vitest:

1. `node packages/cli/dist/bin.js <fixture>` exits with the documented code
   (`packages/cli/test/fixtures/basic-project`; the contract is 0 / 1 / 2 per
   `packages/cli/src/bin.ts`).
2. Each published entry point (`@svelte-vitals/core`, `svelte-vitals`,
   `@svelte-vitals/vite`, `@svelte-vitals/mcp`) imports cleanly under bare `node`.
3. A `.ts` config on the floor Node produces the CLI's guided error, not a raw
   `ERR_UNKNOWN_FILE_EXTENSION` — the assertion promoted from the branch above.

### Fidelity: workspace install, bare-node execution (A-1)

`floor-smoke` reuses the existing `./.github/workflows/setup-node` composite with
`node-version: 22.13.0` and the `packages/*/dist` cache, then invokes `node`
directly rather than through a pnpm script. jsdom lands on disk as part of the
workspace install but is never loaded, which is the whole point: installing is not
executing.

The rejected alternative (A-2) was packing the four packages with `pnpm pack` and
installing the tarballs into a temp project, so the dev tree leaves the floor job's
dependency graph entirely. It is rejected as scope creep: packaging correctness is
already covered by publint + attw in `check`, `workspace:*` would have to be patched
back to the local tarballs via `pnpm.overrides`, and the result is a release
verification job, not a Node floor job.

### The script

A single root-level `scripts/floor-smoke.mjs`, plain ESM with `node:assert`, in the
style of the existing `scripts/verify-svelte-import.js` — which is the same idea
already applied once: verify under a bare runtime the part whose behaviour is
runtime-dependent. Using vitest here would defeat the purpose, so assertions are
hand-rolled.

Exposed as `pnpm smoke` for local use, with the caveat (documented in AGENTS.md
next to the other verify commands) that locally it runs under the devEngines Node —
the floor claim is what CI adds, not the script itself.

## Non-goals

- Raising `engines.node` above 22.13.0. That floor is settled
  (`2026-07-05-config-file-design.md`: "This floor is final") and no runtime
  dependency of a published package requires more.
- Enabling `engine-strict`. It would fail the install on the floor Node because of a
  dev dependency, i.e. exactly the coupling this design removes.
- Pinning jsdom back to 29. jsdom 30's only breaking change is the Node floor.
- Making `floor-smoke` a full end-to-end or release-verification job.

## Files touched

- `.github/workflows/ci.yml` — `test` matrix `22.13.0` → `22`; new `floor-smoke` job.
- `scripts/floor-smoke.mjs` — new.
- `package.json` — `smoke` script.
- `packages/cli/test/config-file.test.ts` — the `.ts` child-process test loses its
  reason to branch on the host Node once the floor assertion lives in the smoke;
  deleted outright rather than kept as a new-Node-only assertion, since running
  `scripts/floor-smoke.mjs` on every `test` matrix entry already covers the
  modern-Node branch under a bare `node` — a check vitest's module runner could
  never provide (see "What the floor job must not lose" above).
- `AGENTS.md` — record the two floors and which job defends which, so the next dev
  dependency that crosses 22.13.0 does not restart this investigation.

## Verification

- `node scripts/floor-smoke.mjs` passes locally.
- CI: `floor-smoke` green on 22.13.0; `test` green on 22 / 24.16.0 / 26.
- Every `test` matrix entry also runs `scripts/floor-smoke.mjs` directly (a bare
  `node`, not through vitest), which is what asserts the modern-Node branch of
  the `.ts`-config check now that `config-file.test.ts` no longer covers it.
- Deliberately break it: temporarily point the smoke at a `.ts` config and confirm
  `floor-smoke` fails on 22.13.0 while `test` stays green — proving the job actually
  discriminates.

## Risks

- **Reduced unit-test coverage on the exact floor version.** Accepted: unit tests run
  transpiled source, never the shipped `dist`, so they were always a proxy for the
  floor claim. The smoke tests the artifact users actually get.
- **The smoke can rot into a no-op** if it stops asserting exit codes or output.
  Mitigated by the deliberate-break step in Verification.
- **The `test` matrix's bare `'22'` entry floats, and floating has a cost.** (a)
  It is not reproducible: two runs of the same commit can resolve to different
  22.x patch versions as new releases land, unlike the pinned `24.16.0` and
  `floor-smoke`'s `22.13.0`. (b) With `engine-strict` off — an explicit non-goal
  above — an unsatisfied dev-dependency `engines.node` on that floating line is
  still silent, just far less likely to bite because `'22'` tracks the latest
  patch instead of sitting still at 22.13.0. Both are accepted as the owned
  tradeoff of floating rather than a defect: pinning `'22'` to a fixed patch
  would recreate the exact staleness problem (a dev dependency quietly
  outrunning a stale floor) that this design exists to fix.
