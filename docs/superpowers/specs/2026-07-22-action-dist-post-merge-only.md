# Design: move packages/action/dist freshness off the PR path

Reverses one call made in `2026-07-09-github-action-design.md` §4: "No release-time build-and-commit choreography needed" — CI's `check` job blocking every PR (`git diff --exit-code -- packages/action/dist` after `pnpm build`) turned out to force a `chore(action): rebuild dist` commit onto nearly every PR touching `packages/core`/`packages/cli` (or anything reachable from the action's bundle graph). Dozens of these commits accumulated, and the generated bundle (a single large, mostly-opaque JS file) conflicts often across concurrent branches with almost no reviewable/mergeable diff overlap — a real, recurring source of contributor friction, not a hypothetical one.

## Decision

Dist freshness is now enforced (and self-healed) only on `main`, never on a PR:

- `.github/workflows/ci.yml`'s `check` job: the "Verify action dist is up to date" step gets `if: github.event_name == 'push'` — it still runs (and would fail loudly) on push to `main`, but never blocks a PR.
- `.github/workflows/release.yml`: a new "Commit refreshed action dist if stale" step, right after `pnpm build` and before the changesets publish step, rebuilds and — if `packages/action/dist` differs — commits and pushes it straight to `main`. This runs on **every** push to `main` (not just release-triggering ones), so any merge that leaves dist stale gets fixed within the same CI run, before a human ever notices.
- `.github/workflows/rebuild-action-dist.yml` (the Renovate-branch-only version of this same fix, added earlier as a narrower patch) is deleted — superseded, since Renovate PRs no longer need dist touched at all.

## Why a PAT, and why `[skip ci]`

`main` requires 1 approving review (`required_pull_request_reviews`), but `enforce_admins` is off. A push authenticated as the repo's actual admin account bypasses the review requirement; `GITHUB_TOKEN` (identity: `github-actions[bot]`) does not qualify and would be rejected. `ACTION_DIST_PAT` (already provisioned for the deleted workflow, reused here) is a fine-grained PAT minted from an admin account with `Contents: read/write` — this is what makes the direct push to `main` possible at all, not an optional convenience.

The commit message includes `[skip ci]` deliberately: a PAT-authenticated push (unlike `GITHUB_TOKEN`) does trigger workflows, but the dist it commits was just produced by this same job's own `pnpm build` — there's nothing new to validate, so a re-run of the whole pipeline (and of `release.yml` itself) would be pure overhead.

## Consequence accepted

Between a merge landing on `main` and this step running, `main`'s committed dist can be momentarily stale. Nothing reads `packages/action/dist` in that window except a human manually cloning at that exact moment or another CI run mid-flight — accepted as strictly better than the prior PR-blocking cost.
