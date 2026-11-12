import { describe, it, expect } from 'vitest';
import { runCiCliGunshi } from '../../src/gunshi/ci.js';
import { WORKFLOW_PATH, buildWorkflowYaml, CHECKOUT_SHA, CHECKOUT_VERSION } from '../../src/ci/workflow.js';
import { ACTION_SHA, ACTION_VERSION } from '../../src/ci/action-pin.generated.js';
import type { InstallIO } from '../../src/install/index.js';

function fakeIO(over: { files?: Record<string, string>; failWritePath?: string; throwOnRead?: string } = {}) {
  const files = over.files ?? {};
  const writes: Record<string, string> = {};
  const out: string[] = [];
  const err: string[] = [];
  const io: InstallIO = {
    readFile: (p) => {
      if (over.throwOnRead && p === over.throwOnRead) {
        throw new Error(`EACCES: permission denied, open '${p}'`);
      }
      return files[p];
    },
    writeFile: (p, c) => {
      if (over.failWritePath && p === over.failWritePath) {
        throw new Error(`EACCES: permission denied, open '${p}'`);
      }
      writes[p] = c;
    },
    cwd: '/proj',
    isTTY: false,
    log: (l) => out.push(l),
    errorLog: (l) => err.push(l)
  };
  return { io, writes, out, err };
}

const PATH = `/proj/${WORKFLOW_PATH}`;

describe('runCiCliGunshi', () => {
  it('with no subcommand prints help to stderr and exits 2, stdout empty', async () => {
    const { io, out, err } = fakeIO();
    expect(await runCiCliGunshi([], io)).toBe(2);
    expect(out).toEqual([]);
    expect(err.join('\n')).toContain('svelte-vitals ci install');
  });

  it('unknown subcommand prints help to stderr and exits 2, stdout empty', async () => {
    const { io, out, err } = fakeIO();
    expect(await runCiCliGunshi(['bogus'], io)).toBe(2);
    expect(out).toEqual([]);
    expect(err.join('\n')).toContain('Usage:');
  });

  it('`ci --help` prints help and exits 0', async () => {
    const { io, out } = fakeIO();
    expect(await runCiCliGunshi(['--help'], io)).toBe(0);
    expect(out.join('\n')).toContain('svelte-vitals ci install');
  });

  it('`ci install --help` prints help and exits 0 without writing', async () => {
    const { io, out, writes } = fakeIO();
    expect(await runCiCliGunshi(['install', '--help'], io)).toBe(0);
    expect(out.join('\n')).toContain('Usage:');
    expect(writes).toEqual({});
  });

  it('dry-run previews the plan and writes nothing', async () => {
    const { io, out, writes } = fakeIO();
    expect(await runCiCliGunshi(['install', '--dry-run'], io)).toBe(0);
    expect(writes).toEqual({});
    expect(out.join('\n')).toContain('Dry run — no files written.');
    expect(out.join('\n')).toContain('[created]');
  });

  it('writes the workflow file when none exists', async () => {
    const { io, writes, out } = fakeIO();
    expect(await runCiCliGunshi(['install'], io)).toBe(0);
    expect(Object.keys(writes)).toEqual([PATH]);
    expect(writes[PATH]).toContain('name: svelte-vitals');
    expect(out.join('\n')).toContain('Done.');
    expect(out.filter((l) => l.startsWith('!'))).toEqual([
      `! Add an install step to ${WORKFLOW_PATH} before the svelte-vitals step: no lockfile was found, so the package manager is unknown (commit your lockfile and re-run with --force to generate the step).`
    ]);
  });

  it('an existing file is left alone (status exists) without --force', async () => {
    const { io, writes, out } = fakeIO({ files: { [PATH]: 'name: old\n' } });
    expect(await runCiCliGunshi(['install'], io)).toBe(0);
    expect(writes).toEqual({});
    expect(out.join('\n')).toContain('already installed');
  });

  it('--force overwrites an existing file', async () => {
    const { io, writes } = fakeIO({ files: { [PATH]: 'name: old\n' } });
    expect(await runCiCliGunshi(['install', '--force'], io)).toBe(0);
    expect(writes[PATH]).toContain('name: svelte-vitals');
  });

  it('returns exit 2 and logs an error when writing fails', async () => {
    const { io, err } = fakeIO({ failWritePath: PATH });
    expect(await runCiCliGunshi(['install'], io)).toBe(2);
    expect(err.join('\n')).toContain('failed to write');
  });
});

describe('runCiCliGunshi install step', () => {
  const DECLARED = JSON.stringify({ devDependencies: { 'svelte-vitals': '^0.1.0' } });
  const notes = (out: string[]) => out.filter((l) => l.startsWith('!'));

  it('writes an npm install step for a project with package-lock.json', async () => {
    const { io, writes } = fakeIO({ files: { '/proj/package-lock.json': '{}', '/proj/package.json': DECLARED } });
    expect(await runCiCliGunshi(['install'], io)).toBe(0);
    expect(writes[PATH]).toContain('      - run: npm ci --ignore-scripts');
  });

  it('writes the pnpm steps for a project that declares pnpm 12', async () => {
    const pkg = JSON.stringify({ packageManager: 'pnpm@12.0.0', devDependencies: { 'svelte-vitals': '^0.1.0' } });
    const { io, writes } = fakeIO({ files: { '/proj/pnpm-lock.yaml': '', '/proj/package.json': pkg } });
    expect(await runCiCliGunshi(['install'], io)).toBe(0);
    expect(writes[PATH]).toContain('      - uses: pnpm/setup@');
    expect(writes[PATH]).toContain('      - run: pnpm install --frozen-lockfile --ignore-scripts');
  });

  it('tells the user to add an install step when it could only leave a commented one', async () => {
    const { io, writes, out } = fakeIO({ files: { '/proj/bun.lock': '', '/proj/package.json': DECLARED } });
    expect(await runCiCliGunshi(['install'], io)).toBe(0);
    expect(writes[PATH]).toContain('      # - run: bun install --frozen-lockfile --ignore-scripts');
    expect(out).toContain(
      `! Add an install step to ${WORKFLOW_PATH} before the svelte-vitals step: this CLI does not pin a setup step for Bun.`
    );
  });

  it('tells the user to add svelte-vitals when package.json does not declare it', async () => {
    const pnpm = fakeIO({ files: { '/proj/pnpm-lock.yaml': '', '/proj/package.json': '{}' } });
    expect(await runCiCliGunshi(['install'], pnpm.io)).toBe(0);
    expect(pnpm.out).toContain(
      '! svelte-vitals is not in package.json. Add it so CI analyzes with the version you choose: pnpm add -D svelte-vitals'
    );
    const npm = fakeIO({ files: { '/proj/package-lock.json': '{}', '/proj/package.json': '{}' } });
    expect(await runCiCliGunshi(['install'], npm.io)).toBe(0);
    expect(npm.out.join('\n')).toContain('npm install -D svelte-vitals');
  });

  it.each([
    ['a pnpm-workspace.yaml', { '/proj/pnpm-workspace.yaml': 'packages:\n  - apps/*\n', '/proj/package.json': '{}' }],
    ['a workspaces field', { '/proj/package.json': JSON.stringify({ workspaces: ['apps/*'] }) }],
    ['no package.json', {}]
  ])('does not tell the user to add svelte-vitals at a root with %s', async (_, files) => {
    const { io, out } = fakeIO({ files: { '/proj/pnpm-lock.yaml': '', ...files } });
    expect(await runCiCliGunshi(['install'], io)).toBe(0);
    expect(out.join('\n')).not.toContain('svelte-vitals is not in package.json');
  });

  it('says nothing extra when the step is live and svelte-vitals is declared', async () => {
    const { io, out } = fakeIO({ files: { '/proj/package-lock.json': '{}', '/proj/package.json': DECLARED } });
    expect(await runCiCliGunshi(['install'], io)).toBe(0);
    expect(notes(out)).toEqual([]);
  });

  it('shows the same notes on --dry-run and writes nothing', async () => {
    const files = { '/proj/bun.lock': '', '/proj/package.json': '{}' };
    const real = fakeIO({ files });
    await runCiCliGunshi(['install'], real.io);
    const dry = fakeIO({ files });
    expect(await runCiCliGunshi(['install', '--dry-run'], dry.io)).toBe(0);
    expect(dry.writes).toEqual({});
    expect(notes(dry.out)).toHaveLength(2);
    expect(notes(dry.out)).toEqual(notes(real.out));
  });

  it('a package.json read failure stops before the workflow is written', async () => {
    const { io, writes, err } = fakeIO({
      files: { '/proj/package-lock.json': '{}' },
      throwOnRead: '/proj/package.json'
    });
    await expect(runCiCliGunshi(['install'], io)).rejects.toThrow('EACCES');
    expect(writes).toEqual({});
    expect(err.join('\n')).not.toContain('failed to write');
  });

  it('says nothing extra when the workflow already exists', async () => {
    const files = { [PATH]: 'name: old\n', '/proj/bun.lock': '', '/proj/package.json': '{}' };
    for (const args of [['install'], ['install', '--dry-run']]) {
      const { io, out } = fakeIO({ files });
      expect(await runCiCliGunshi(args, io)).toBe(0);
      expect(notes(out)).toEqual([]);
    }
  });
});

describe('runCiCliGunshi upgrade', () => {
  const OLD_SHA = '1'.repeat(40);
  const oldWorkflow = buildWorkflowYaml({ actionSha: OLD_SHA, actionVersion: '0.1.0', installStep: { kind: 'npm' } });

  it('with no workflow file, exits 2 with an install hint', async () => {
    const { io, err } = fakeIO();
    expect(await runCiCliGunshi(['upgrade'], io)).toBe(2);
    expect(err.join('\n')).toContain('run `svelte-vitals ci install` first');
  });

  it('with a workflow that has no action reference, exits 2', async () => {
    const { io, err } = fakeIO({ files: { [PATH]: 'name: no-action-here\n' } });
    expect(await runCiCliGunshi(['upgrade'], io)).toBe(2);
    expect(err.join('\n')).toContain('no @svelte-vitals/action reference found');
  });

  it('when already pinned to the bundled sha, says so without claiming to be up to date, and writes nothing', async () => {
    const current = buildWorkflowYaml({
      actionSha: ACTION_SHA,
      actionVersion: ACTION_VERSION,
      installStep: { kind: 'npm' }
    });
    const { io, writes, out } = fakeIO({ files: { [PATH]: current } });
    expect(await runCiCliGunshi(['upgrade'], io)).toBe(0);
    expect(writes).toEqual({});
    expect(out.join('\n')).toContain(
      `already on the pin bundled with this CLI (@svelte-vitals/action@${ACTION_VERSION})`
    );
    expect(out.join('\n')).not.toContain('up to date');
  });

  it('upgrades a stale pin, rewriting only the action line', async () => {
    const { io, writes, out } = fakeIO({ files: { [PATH]: oldWorkflow } });
    expect(await runCiCliGunshi(['upgrade'], io)).toBe(0);
    expect(writes[PATH]).toContain(`uses: oekazuma/svelte-vitals-action@${ACTION_SHA} # v${ACTION_VERSION}`);
    // The other pinned action (actions/checkout) is untouched.
    expect(writes[PATH]).toContain(`uses: actions/checkout@${CHECKOUT_SHA} # ${CHECKOUT_VERSION}`);
    expect(out.join('\n')).toContain('upgraded @svelte-vitals/action');
  });

  it('--dry-run previews the upgrade and writes nothing', async () => {
    const { io, writes, out } = fakeIO({ files: { [PATH]: oldWorkflow } });
    expect(await runCiCliGunshi(['upgrade', '--dry-run'], io)).toBe(0);
    expect(writes).toEqual({});
    expect(out.join('\n')).toContain('Dry run — no files written.');
    expect(out.join('\n')).toContain('Would upgrade');
  });

  it('`ci upgrade --help` prints help and exits 0 without writing', async () => {
    const { io, out, writes } = fakeIO({ files: { [PATH]: oldWorkflow } });
    expect(await runCiCliGunshi(['upgrade', '--help'], io)).toBe(0);
    expect(out.join('\n')).toContain('svelte-vitals ci upgrade');
    expect(writes).toEqual({});
  });

  it('returns exit 2 and logs an error when writing fails', async () => {
    const { io, err } = fakeIO({ files: { [PATH]: oldWorkflow }, failWritePath: PATH });
    expect(await runCiCliGunshi(['upgrade'], io)).toBe(2);
    expect(err.join('\n')).toContain('failed to write');
  });
});
