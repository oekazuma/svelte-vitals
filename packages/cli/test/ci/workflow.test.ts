import { describe, it, expect } from 'vitest';
import {
  PNPM_SETUP_SHA,
  PNPM_SETUP_VERSION,
  WORKFLOW_PATH,
  buildWorkflowYaml,
  planWorkflowWrite
} from '../../src/ci/workflow.js';
import type { InstallStepPlan } from '../../src/ci/install-step.js';

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
  const yaml = buildWorkflowYaml({ actionSha: sha, actionVersion: '1.2.3', installStep: { kind: 'npm' } });

  it('checks out full history (fetch-depth: 0) so diff/baseline can resolve the base ref', () => {
    expect(yaml).toContain('fetch-depth: 0');
  });

  it('does not persist the job token in the checked-out git config', () => {
    expect(yaml).toContain('persist-credentials: false');
  });

  it('calls the action pinned to a commit SHA with a same-line version comment', () => {
    expect(yaml).toContain(`uses: oekazuma/svelte-vitals-action@${sha} # v1.2.3`);
  });

  it('pins actions/checkout to a commit SHA with a same-line version comment, not a floating tag', () => {
    expect(yaml).toMatch(/uses: actions\/checkout@[0-9a-f]{40} # v\d+\.\d+\.\d+/);
    expect(yaml).not.toContain('actions/checkout@v4');
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

  const manual: InstallStepPlan = {
    kind: 'manual',
    command: 'bun install --frozen-lockfile --ignore-scripts',
    reason: 'x'
  };
  const variants = {
    npm: { plan: { kind: 'npm' }, marker: '      - run: npm ci --ignore-scripts' },
    pnpm: { plan: { kind: 'pnpm' }, marker: '      - uses: pnpm/setup@' },
    manual: { plan: manual, marker: '      # - run: bun install' }
  } satisfies Record<InstallStepPlan['kind'], { plan: InstallStepPlan; marker: string }>;
  const build = (installStep: InstallStepPlan) =>
    buildWorkflowYaml({ actionSha: sha, actionVersion: '1.2.3', installStep });

  it('installs with npm ci and no lifecycle scripts', () => {
    expect(build({ kind: 'npm' })).toContain('      - run: npm ci --ignore-scripts');
  });

  it('sets up pnpm at the pinned SHA without installing, then installs without lifecycle scripts', () => {
    const out = build({ kind: 'pnpm' });
    expect(out).toContain(`      - uses: pnpm/setup@${PNPM_SETUP_SHA} # ${PNPM_SETUP_VERSION}`);
    expect(out).toContain('          install: false');
    expect(out).toContain('      - run: pnpm install --frozen-lockfile --ignore-scripts');
  });

  it('leaves a commented install step when it cannot write a working one', () => {
    const out = build(manual);
    expect(out).toContain('      # - run: bun install --frozen-lockfile --ignore-scripts');
    expect(out.split('\n').some((l) => l.startsWith('      - run:'))).toBe(false);
  });

  it.each(['npm', 'pnpm', 'manual'] as const)(
    'puts the %s install step after checkout and before the action',
    (kind) => {
      const out = build(variants[kind].plan);
      const step = out.indexOf(variants[kind].marker);
      expect(out.indexOf('actions/checkout@')).toBeLessThan(step);
      expect(step).toBeLessThan(out.indexOf('oekazuma/svelte-vitals-action@'));
    }
  );

  it('never marks the install step continue-on-error', () => {
    for (const { plan } of Object.values(variants)) {
      expect(build(plan)).not.toContain('continue-on-error');
    }
  });
});
