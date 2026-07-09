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
