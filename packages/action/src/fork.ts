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
  return (
    ctx.eventName === 'pull_request' && ctx.headRepoFullName !== undefined && ctx.headRepoFullName !== ctx.repoFullName
  );
}
