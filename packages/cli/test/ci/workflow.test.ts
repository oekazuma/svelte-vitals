import { describe, it, expect } from 'vitest';
import {
  PNPM_SETUP_SHA,
  PNPM_SETUP_VERSION,
  SETUP_NODE_SHA,
  SETUP_NODE_VERSION,
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
  const manual: InstallStepPlan = {
    kind: 'manual',
    command: 'bun install --frozen-lockfile --ignore-scripts',
    reason: 'x'
  };
  const build = (installStep: InstallStepPlan, appPath?: string) => buildWorkflowYaml({ installStep, appPath });
  const yaml = build({ kind: 'npm' });

  it('checks out full history (fetch-depth: 0) so diff/baseline can resolve the base ref', () => {
    expect(yaml).toContain('fetch-depth: 0');
  });

  it('does not persist the job token in the checked-out git config', () => {
    expect(yaml).toContain('persist-credentials: false');
  });

  it('contains no reference to the retired action', () => {
    for (const kind of ['npm', 'pnpm'] as const) {
      expect(build({ kind })).not.toContain('svelte-vitals-action');
      expect(build({ kind })).not.toContain('pull-requests: write');
    }
    expect(build(manual)).not.toContain('svelte-vitals-action');
  });

  it('pins actions/checkout to a commit SHA with a same-line version comment, not a floating tag', () => {
    expect(yaml).toMatch(/uses: actions\/checkout@[0-9a-f]{40} # v\d+\.\d+\.\d+/);
    expect(yaml).not.toContain('actions/checkout@v4');
  });

  it('pins actions/setup-node with a same-line version comment (npm shape)', () => {
    expect(yaml).toContain(`      - uses: actions/setup-node@${SETUP_NODE_SHA} # ${SETUP_NODE_VERSION}`);
    expect(yaml).toContain('          node-version: 24');
  });

  it('pnpm shape sets runtime: node and has no setup-node step', () => {
    const out = build({ kind: 'pnpm' });
    expect(out).toContain('          runtime: node');
    expect(out).not.toContain('setup-node');
  });

  it('runs the installed bin, never a registry fetch', () => {
    for (const kind of ['npm', 'pnpm'] as const) {
      const out = build({ kind });
      expect(out).toContain('./node_modules/.bin/svelte-vitals --reporter github');
      for (const fetcher of ['npx', 'pnpm exec', 'dlx']) expect(out).not.toContain(fetcher);
    }
  });

  it('passes the base ref through env, with no expression in any run step', () => {
    expect(yaml).toContain('--diff "origin/$BASE_REF" --baseline "origin/$BASE_REF"');
    expect(yaml).toContain('          BASE_REF: ${{ github.base_ref }}');
    const runs = yaml.split('\n').filter((l) => l.trimStart().startsWith('- run:'));
    expect(runs.length).toBeGreaterThan(0);
    for (const l of runs) expect(l).not.toContain('${{');
  });

  it('passes appPath as the first argument', () => {
    expect(build({ kind: 'npm' }, 'apps/web')).toContain('svelte-vitals apps/web --reporter github');
  });

  it('contains no tab characters (YAML indentation must be spaces)', () => {
    expect(yaml).not.toContain('\t');
  });

  it('installs with npm ci and no lifecycle scripts', () => {
    expect(yaml).toContain('      - run: npm ci --ignore-scripts');
  });

  it('sets up pnpm at the pinned SHA without installing, then installs without lifecycle scripts', () => {
    const out = build({ kind: 'pnpm' });
    expect(out).toContain(`      - uses: pnpm/setup@${PNPM_SETUP_SHA} # ${PNPM_SETUP_VERSION}`);
    expect(out).toContain('          install: false');
    expect(out).toContain('      - run: pnpm install --frozen-lockfile --ignore-scripts');
  });

  it('manual shape keeps install commented and the run step live', () => {
    const out = build(manual);
    expect(out).toContain(
      [
        '      # Set up Node.js 24.16.0 or newer and your package manager, then install dependencies.',
        '      # Without an install the next step fails: it runs the svelte-vitals in node_modules.',
        '      # - run: bun install --frozen-lockfile --ignore-scripts'
      ].join('\n')
    );
    const live = out.split('\n').filter((l) => l.startsWith('      - run:'));
    expect(live).toHaveLength(1);
    expect(live[0]).toContain('./node_modules/.bin/svelte-vitals');
  });

  it.each([
    ['npm', '      - run: npm ci --ignore-scripts'],
    ['pnpm', '      - uses: pnpm/setup@'],
    ['manual', '      # - run: bun install']
  ] as const)('puts the %s install step after checkout and before the analysis', (kind, marker) => {
    const out = build(kind === 'manual' ? manual : { kind });
    const step = out.indexOf(marker);
    expect(out.indexOf('actions/checkout@')).toBeLessThan(step);
    expect(step).toBeLessThan(out.indexOf('./node_modules/.bin/svelte-vitals'));
  });

  it('never marks the install step continue-on-error', () => {
    for (const plan of [{ kind: 'npm' }, { kind: 'pnpm' }, manual] as const) {
      expect(build(plan)).not.toContain('continue-on-error');
    }
  });
});
