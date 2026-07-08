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
  const yaml = buildWorkflowYaml({ version: '1.2.3' });

  it('substitutes the version and leaves no __VERSION__ placeholder behind', () => {
    expect(yaml).not.toContain('__VERSION__');
    expect(yaml).toContain('npx -y svelte-vitals@1.2.3 .');
  });

  it('checks out full history (fetch-depth: 0) so --baseline/--diff can resolve the base ref', () => {
    expect(yaml).toContain('fetch-depth: 0');
  });

  it('gates on findings newly introduced vs. the PR base via --baseline', () => {
    expect(yaml).toContain('--baseline origin/${{ github.base_ref }}');
    expect(yaml).toContain('--diff origin/${{ github.base_ref }}');
  });

  it('uses the github reporter for annotations and the md reporter for the summary', () => {
    expect(yaml).toContain('--reporter github');
    expect(yaml).toContain('--reporter md > svelte-vitals-report.md');
  });

  it('posts a sticky PR comment keyed by a stable marker', () => {
    expect(yaml).toContain('<!-- svelte-vitals-report -->');
    expect(yaml).toContain('updateComment');
    expect(yaml).toContain('createComment');
  });

  it('re-raises the scan failure in the final Gate step', () => {
    expect(yaml).toContain("if: steps.scan.outcome == 'failure'");
    expect(yaml).toContain('exit 1');
  });

  it('contains no tab characters (YAML indentation must be spaces)', () => {
    expect(yaml).not.toContain('\t');
  });
});
