import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { STICKY_COMMENT_MARKER } from '../src/sticky-comment.js';

// `fork.ts`/`sticky-comment.ts` are pure helpers already covered by their own test
// files — main() uses the real implementations here. Only the external SDK surface
// (@actions/core, @actions/github, svelte-vitals, @svelte-vitals/core) is mocked, using
// the same "vi.mock before importing the module under test" pattern as
// packages/vite/test/plugin-error.test.ts.
const h = vi.hoisted(() => {
  const inputs: Record<string, string> = {};

  const getInput = vi.fn((name: string) => inputs[name] ?? '');
  const info = vi.fn();
  const warning = vi.fn();
  const setFailed = vi.fn();
  const write = vi.fn(async () => {});
  const addRaw = vi.fn(() => ({ write }));

  const context: {
    eventName: string;
    repo: { owner: string; repo: string };
    payload: { pull_request?: Record<string, unknown> };
  } = {
    eventName: 'push',
    repo: { owner: 'oekazuma', repo: 'svelte-vitals' },
    payload: {}
  };

  const listComments = vi.fn(async () => ({ data: [] as { id: number; body: string | null }[] }));
  const updateComment = vi.fn<(params: Record<string, unknown>) => Promise<Record<string, unknown>>>(async () => ({}));
  const createComment = vi.fn<(params: Record<string, unknown>) => Promise<Record<string, unknown>>>(async () => ({}));
  const getOctokit = vi.fn(() => ({
    rest: {
      issues: { listComments, updateComment, createComment }
    }
  }));

  const analyzeProject = vi.fn(async () => ({
    results: [],
    config: { failOn: 'critical' },
    version: '0.0.0-test'
  }));
  const applyScope = vi.fn(async (results: unknown[]) => results);

  const formatGithubReport = vi.fn(() => 'annotations');
  const formatMarkdownReport = vi.fn(() => 'markdown report');
  const summarize = vi.fn(() => ({}));
  const hasFailureAtOrAbove = vi.fn(() => false);

  return {
    inputs,
    getInput,
    info,
    warning,
    setFailed,
    write,
    addRaw,
    context,
    listComments,
    updateComment,
    createComment,
    getOctokit,
    analyzeProject,
    applyScope,
    formatGithubReport,
    formatMarkdownReport,
    summarize,
    hasFailureAtOrAbove
  };
});

vi.mock('@actions/core', () => ({
  getInput: h.getInput,
  info: h.info,
  warning: h.warning,
  setFailed: h.setFailed,
  summary: { addRaw: h.addRaw }
}));

vi.mock('@actions/github', () => ({
  context: h.context,
  getOctokit: h.getOctokit
}));

vi.mock('svelte-vitals', () => ({
  analyzeProject: h.analyzeProject,
  applyScope: h.applyScope
}));

vi.mock('@svelte-vitals/core', () => ({
  formatGithubReport: h.formatGithubReport,
  formatMarkdownReport: h.formatMarkdownReport,
  summarize: h.summarize,
  hasFailureAtOrAbove: h.hasFailureAtOrAbove
}));

// Importing this module runs its top-level `main().catch(...)` as a side effect (that
// call is the real action's entry point — see packages/action/src/index.ts — and must
// stay). `beforeAll` below drains that one extra invocation before any test's own
// `main()` call and assertions run.
import { main } from '../src/index.js';

function setPullRequest(payload: Record<string, unknown> | undefined): void {
  h.context.payload.pull_request = payload;
}

beforeAll(async () => {
  // Flush the microtask chain kicked off by the module's own top-level `main()` call
  // so it doesn't pollute the call counts asserted by the first real test.
  await new Promise((resolve) => setTimeout(resolve, 0));
});

beforeEach(() => {
  vi.stubEnv('GITHUB_TOKEN', '');
  vi.clearAllMocks();

  for (const key of Object.keys(h.inputs)) delete h.inputs[key];
  h.context.eventName = 'push';
  h.context.repo = { owner: 'oekazuma', repo: 'svelte-vitals' };
  h.context.payload = {};

  h.listComments.mockResolvedValue({ data: [] });
  h.hasFailureAtOrAbove.mockReturnValue(false);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('main()', () => {
  it('creates a new sticky comment on a same-repo PR with no existing report comment', async () => {
    h.inputs['github-token'] = 'gh-token';
    h.context.eventName = 'pull_request';
    setPullRequest({ number: 42, head: { repo: { full_name: 'oekazuma/svelte-vitals' } } });
    h.listComments.mockResolvedValue({ data: [] });

    await main();

    expect(h.createComment).toHaveBeenCalledTimes(1);
    expect(h.updateComment).not.toHaveBeenCalled();
    expect(h.createComment.mock.calls[0]![0]).toMatchObject({
      owner: 'oekazuma',
      repo: 'svelte-vitals',
      issue_number: 42,
      body: `${STICKY_COMMENT_MARKER}\nmarkdown report`
    });
  });

  it('updates the existing sticky comment on a same-repo PR', async () => {
    h.inputs['github-token'] = 'gh-token';
    h.context.eventName = 'pull_request';
    setPullRequest({ number: 7, head: { repo: { full_name: 'oekazuma/svelte-vitals' } } });
    h.listComments.mockResolvedValue({
      data: [{ id: 99, body: `${STICKY_COMMENT_MARKER}\nold report` }]
    });

    await main();

    expect(h.updateComment).toHaveBeenCalledTimes(1);
    expect(h.updateComment.mock.calls[0]![0]).toMatchObject({
      owner: 'oekazuma',
      repo: 'svelte-vitals',
      comment_id: 99,
      body: `${STICKY_COMMENT_MARKER}\nmarkdown report`
    });
    expect(h.createComment).not.toHaveBeenCalled();
  });

  it('skips the comment step entirely for a fork PR, but still emits annotations and the job summary', async () => {
    h.inputs['github-token'] = 'gh-token';
    h.context.eventName = 'pull_request';
    setPullRequest({ number: 3, head: { repo: { full_name: 'someone-else/svelte-vitals' } } });

    await main();

    expect(h.getOctokit).not.toHaveBeenCalled();
    expect(h.info).toHaveBeenCalledWith('annotations');
    expect(h.addRaw).toHaveBeenCalledWith('markdown report');
    expect(h.write).toHaveBeenCalledTimes(1);
  });

  it('skips the comment step entirely for a non-PR event (e.g. push)', async () => {
    h.inputs['github-token'] = 'gh-token';
    h.context.eventName = 'push';
    setPullRequest(undefined);

    await main();

    expect(h.getOctokit).not.toHaveBeenCalled();
    expect(h.createComment).not.toHaveBeenCalled();
    expect(h.updateComment).not.toHaveBeenCalled();
  });

  it('warns instead of failing the build when the octokit call throws', async () => {
    h.inputs['github-token'] = 'gh-token';
    h.context.eventName = 'pull_request';
    setPullRequest({ number: 5, head: { repo: { full_name: 'oekazuma/svelte-vitals' } } });
    h.listComments.mockRejectedValueOnce(new Error('boom: rate limited'));

    await expect(main()).resolves.toBeUndefined();

    expect(h.warning).toHaveBeenCalledTimes(1);
    expect(h.warning.mock.calls[0]![0]).toMatch(/failed to post\/update the PR comment/);
    expect(h.warning.mock.calls[0]![0]).toMatch(/boom: rate limited/);
    expect(h.setFailed).not.toHaveBeenCalled();
  });

  it('fails the build when hasFailureAtOrAbove reports a blocking finding', async () => {
    h.hasFailureAtOrAbove.mockReturnValue(true);

    await main();

    expect(h.setFailed).toHaveBeenCalledTimes(1);
    expect(h.setFailed).toHaveBeenCalledWith('svelte-vitals found blocking issues (see annotations above).');
  });

  it('does not fail the build when hasFailureAtOrAbove reports no blocking finding', async () => {
    h.hasFailureAtOrAbove.mockReturnValue(false);

    await main();

    expect(h.setFailed).not.toHaveBeenCalled();
  });
});
