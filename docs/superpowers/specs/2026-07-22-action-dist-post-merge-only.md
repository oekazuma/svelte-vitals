# Design: move packages/action/dist freshness off the PR path

Reverses one call made in `2026-07-09-github-action-design.md` §4: "No release-time build-and-commit choreography needed" — CI's `check` job blocking every PR (`git diff --exit-code -- packages/action/dist` after `pnpm build`) turned out to force a `chore(action): rebuild dist` commit onto nearly every PR touching `packages/core`/`packages/cli` (or anything reachable from the action's bundle graph). Dozens of these commits accumulated, and the generated bundle (a single large, mostly-opaque JS file) conflicts often across concurrent branches with almost no reviewable/mergeable diff overlap — a real, recurring source of contributor friction, not a hypothetical one.

## Decision

Dist freshness is now enforced (and self-healed) only on `main`, never on a PR, and by exactly one mechanism:

- `.github/workflows/ci.yml`'s `check` job **no longer checks dist freshness at all** — an earlier iteration of this change added a push-only `if: github.event_name == 'push'` verification step here, but that's actively wrong: `ci.yml` and `release.yml` are independent workflows that both trigger on the same push and run concurrently. `ci.yml`'s checkout is pinned to the original commit and can never observe the fix-up commit `release.yml` produces moments later — so a check here would fail red on exactly the merges the self-heal exists to handle, for zero additional protection (caught in review, not shipped).
- `.github/workflows/release.yml`: a new "Commit refreshed action dist if stale" step, right after `pnpm build` and before the changesets publish step, rebuilds and — if `packages/action/dist` differs — commits and pushes it straight to `main`. This runs on **every** push to `main` (not just release-triggering ones), so any merge that leaves dist stale gets fixed within the same CI run, before a human ever notices. This is now the sole enforcement point.
- `.github/workflows/rebuild-action-dist.yml` (the Renovate-branch-only version of this same fix, added earlier as a narrower patch) is deleted — superseded, since Renovate PRs no longer need dist touched at all.

## Why a PAT, and why `[skip ci]`

`main` requires 1 approving review (`required_pull_request_reviews`), but `enforce_admins` is off. A push authenticated as the repo's actual admin account bypasses the review requirement; `GITHUB_TOKEN` (identity: `github-actions[bot]`) does not qualify and would be rejected. `ACTION_DIST_PAT` (already provisioned for the deleted workflow, reused here) is a fine-grained PAT minted from an admin account with `Contents: read/write` — this is what makes the direct push to `main` possible at all, not an optional convenience.

The commit message includes `[skip ci]` deliberately: a PAT-authenticated push (unlike `GITHUB_TOKEN`) does trigger workflows, but the dist it commits was just produced by this same job's own `pnpm build` — there's nothing new to validate, so a re-run of the whole pipeline (and of `release.yml` itself) would be pure overhead.

## Consequence accepted

Between a merge landing on `main` and this step running, `main`'s committed dist can be momentarily stale. Nothing reads `packages/action/dist` in that window except a human manually cloning at that exact moment or another CI run mid-flight — accepted as strictly better than the prior PR-blocking cost.

## Follow-up fixes (review)

- Staleness detection uses `git status --porcelain` (not `git diff`), in both this doc's original design and the shipped release.yml step — `git diff` alone only sees changes to already-tracked files and would silently miss a future tsup output change that adds a new untracked file.
- `release.yml` gained a `concurrency: { group: release-main, cancel-in-progress: false }` block: two merges landing close together would otherwise let two runs race on the dist-commit push to `main`, non-fast-forwarding one of them.

## Correction (2026-07-23): the PAT-push-to-main theory was wrong

The "Why a PAT" section above was never actually verified against a real release — and the first real one (triggered by #287's merge) proved it wrong: the push failed with `GH006: Protected branch update failed for refs/heads/main. - Changes must be made through a pull request`, regardless of `enforce_admins: false` and the PAT being admin-owned. Whatever exempts real admins from `enforce_admins` did not extend to this PAT's push in practice.

Worse than the dist step failing on its own: the step had no `continue-on-error`, so its failure silently skipped every step after it in the same job — **the actual changesets publish and private-package tagging steps never ran**, on every push to `main`, until this was caught (a merged PR's changeset sat unconsumed on `main`, and the standing "Version Packages" PR quietly stopped reflecting new changesets). This is a more serious defect than the dist mechanism itself: a best-effort side task (keeping a committed bundle in sync) was allowed to block the actual release pipeline.

Fixed by switching the mechanism from a direct push to opening a small PR (plain `GITHUB_TOKEN`, no PAT needed — creating a branch and a PR isn't restricted by branch protection, only merging into `main` is, same as any other PR) and adding `continue-on-error: true` to the step so it can never again block what comes after it. The PR still needs one human approval+merge, same as everything else — worse than the originally-intended zero-touch ideal, but correctly scoped to what the repo's actual protection rules allow, and it only fires when dist actually drifts (rare), not on every PR (the original problem this whole design solves). `ACTION_DIST_PAT` is no longer referenced by any workflow as of this correction — worth revoking if not needed elsewhere.
