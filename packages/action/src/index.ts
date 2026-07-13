import * as core from '@actions/core';
import * as github from '@actions/github';
import { analyzeProject, applyScope } from 'svelte-vitals';
import { formatGithubReport, formatMarkdownReport, summarize, hasFailureAtOrAbove } from '@svelte-vitals/core';
import { isForkPR } from './fork.js';
import { planStickyComment, STICKY_COMMENT_MARKER } from './sticky-comment.js';

export async function main(): Promise<void> {
  const path = core.getInput('path') || '.';
  const diff = core.getInput('diff') || undefined;
  const baseline = core.getInput('baseline') || undefined;
  const token = core.getInput('github-token') || process.env.GITHUB_TOKEN || '';

  const analysis = await analyzeProject({ cwd: path });
  const { config, version } = analysis;
  const results = await applyScope(analysis.results, {
    cwd: path,
    config,
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
      // A transient GitHub API/permission failure here must not fail an otherwise-clean
      // scan (the old inline template's comment step carried continue-on-error: true for
      // the same reason) — only the gate below may call core.setFailed.
      try {
        const octokit = github.getOctokit(token);
        const body = `${STICKY_COMMENT_MARKER}\n${markdown}`;
        const { data: comments } = await octokit.rest.issues.listComments({
          owner: ctx.repo.owner,
          repo: ctx.repo.repo,
          issue_number: pr.number,
          per_page: 100
        });
        const plan = planStickyComment(comments.map((c) => ({ id: c.id, body: c.body })));
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
      } catch (err) {
        core.warning(
          `svelte-vitals: failed to post/update the PR comment: ${err instanceof Error ? err.message : String(err)}`
        );
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
