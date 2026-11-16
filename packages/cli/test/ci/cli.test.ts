import { describe, it, expect } from 'vitest';
import { runCiCliGunshi } from '../../src/gunshi/ci.js';
import { WORKFLOW_PATH, buildWorkflowYaml } from '../../src/ci/workflow.js';
import type { InstallIO } from '../../src/install/index.js';

function fakeIO(
  over: {
    files?: Record<string, string>;
    failWritePath?: string;
    throwOnRead?: string;
    discoverApps?: (cwd: string) => Promise<string[]>;
  } = {}
) {
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
    errorLog: (l) => err.push(l),
    discoverApps: over.discoverApps ?? (async () => [])
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
      '! package.json does not declare svelte-vitals, and the svelte-vitals step runs ./node_modules/.bin/svelte-vitals. Add it: pnpm add -D svelte-vitals'
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

  it('notes that several SvelteKit apps make the step exit 2 without an app path', async () => {
    const files = { '/proj/package-lock.json': '{}', '/proj/package.json': DECLARED };
    const many = fakeIO({ files, discoverApps: async () => ['apps/admin', 'apps/web'] });
    expect(await runCiCliGunshi(['install'], many.io)).toBe(0);
    expect(many.out).toContain(
      "! Several SvelteKit apps were found (apps/admin, apps/web), and with no app path the svelte-vitals step exits 2. Add the app's path after ./node_modules/.bin/svelte-vitals in the step, or re-run svelte-vitals install --client ci-workflow --app <dir> --force."
    );
    const one = fakeIO({ files, discoverApps: async () => ['apps/web'] });
    expect(await runCiCliGunshi(['install'], one.io)).toBe(0);
    expect(notes(one.out)).toEqual([]);
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

describe('runCiCliGunshi migration notes', () => {
  const ACTION_WORKFLOW = `${buildWorkflowYaml({ installStep: { kind: 'npm' } })}      - uses: oekazuma/svelte-vitals-action@${'1'.repeat(40)} # v0.15.2\n`;
  const RETIRED_NOTE = `! ${WORKFLOW_PATH} still calls oekazuma/svelte-vitals-action, which is retired. Re-run with --force to replace it with the CLI step.`;
  const WORKSPACE_NOTE =
    '! This is a workspace root. The svelte-vitals step runs ./node_modules/.bin/svelte-vitals here; if svelte-vitals is declared in an app instead, add working-directory: <app> to that step.';
  const oldCliNote = (v: string) =>
    `! node_modules has svelte-vitals ${v}. The workflow needs 0.57.0 or newer for the job summary and repository-relative annotations; update the devDependency.`;
  const notes = (out: string[]) => out.filter((l) => l.startsWith('!'));
  const LOCK = { '/proj/package-lock.json': '{}' };
  const DECLARED = JSON.stringify({ devDependencies: { 'svelte-vitals': '^0.57.0' } });
  const installed = (version: string) => ({
    '/proj/node_modules/svelte-vitals/package.json': JSON.stringify({ name: 'svelte-vitals', version })
  });

  it('ci upgrade exits 2 with the usage error', async () => {
    const { io, out, err, writes } = fakeIO({ files: { [PATH]: ACTION_WORKFLOW } });
    expect(await runCiCliGunshi(['upgrade'], io)).toBe(2);
    expect(out).toEqual([]);
    expect(err.join('\n')).toContain('Usage:');
    expect(writes).toEqual({});
  });

  it('an existing workflow that calls the retired action gets the --force note, on --dry-run too', async () => {
    for (const args of [['install'], ['install', '--dry-run']]) {
      const { io, out, writes } = fakeIO({
        files: { [PATH]: ACTION_WORKFLOW, ...LOCK, '/proj/package.json': DECLARED }
      });
      expect(await runCiCliGunshi(args, io)).toBe(0);
      expect(writes).toEqual({});
      expect(notes(out)).toEqual([RETIRED_NOTE]);
    }
  });

  it('a workflow on the pre-split action path gets the same --force note', async () => {
    const old = `      - uses: oekazuma/svelte-vitals/packages/action@${'1'.repeat(40)} # action-v1.2.3\n`;
    const { io, out } = fakeIO({ files: { [PATH]: old, ...LOCK, '/proj/package.json': DECLARED } });
    expect(await runCiCliGunshi(['install'], io)).toBe(0);
    expect(notes(out)).toEqual([RETIRED_NOTE]);
  });

  it('--force replaces a workflow that calls the retired action without the note', async () => {
    const { io, out, writes } = fakeIO({ files: { [PATH]: ACTION_WORKFLOW, ...LOCK, '/proj/package.json': DECLARED } });
    expect(await runCiCliGunshi(['install', '--force'], io)).toBe(0);
    expect(writes[PATH]).not.toContain('svelte-vitals-action');
    expect(notes(out)).toEqual([]);
  });

  it('at a workspace root that does not declare svelte-vitals, says where the step runs', async () => {
    const roots: Record<string, string>[] = [
      { '/proj/pnpm-workspace.yaml': 'packages:\n  - apps/*\n', '/proj/package.json': '{}' },
      { '/proj/package.json': JSON.stringify({ workspaces: ['apps/*'] }) }
    ];
    for (const files of roots) {
      const { io, out } = fakeIO({ files: { ...LOCK, ...files } });
      expect(await runCiCliGunshi(['install'], io)).toBe(0);
      expect(notes(out)).toEqual([WORKSPACE_NOTE]);
    }
  });

  it('a workspace root that declares svelte-vitals gets no workspace note', async () => {
    const pkg = JSON.stringify({ workspaces: ['apps/*'], devDependencies: { 'svelte-vitals': '^0.57.0' } });
    const { io, out } = fakeIO({ files: { ...LOCK, '/proj/package.json': pkg } });
    expect(await runCiCliGunshi(['install'], io)).toBe(0);
    expect(notes(out)).toEqual([]);
  });

  it('names an installed svelte-vitals older than the workflow needs', async () => {
    const { io, out } = fakeIO({ files: { ...LOCK, '/proj/package.json': DECLARED, ...installed('0.56.1') } });
    expect(await runCiCliGunshi(['install'], io)).toBe(0);
    expect(notes(out)).toEqual([oldCliNote('0.56.1')]);
  });

  it.each(['0.57.0', '0.57.0-next.1', '0.57.0+build.1', '1.0.0'])(
    'says nothing about an installed svelte-vitals %s',
    async (v) => {
      const { io, out } = fakeIO({ files: { ...LOCK, '/proj/package.json': DECLARED, ...installed(v) } });
      expect(await runCiCliGunshi(['install'], io)).toBe(0);
      expect(notes(out)).toEqual([]);
    }
  );
});
