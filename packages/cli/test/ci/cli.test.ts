import { describe, it, expect } from 'vitest';
import { runCiCliGunshi } from '../../src/gunshi/ci.js';
import { WORKFLOW_PATH, buildWorkflowYaml, CHECKOUT_SHA, CHECKOUT_VERSION } from '../../src/ci/workflow.js';
import { ACTION_SHA, ACTION_VERSION } from '../../src/ci/action-pin.generated.js';
import type { InstallIO } from '../../src/install/index.js';

function fakeIO(over: { files?: Record<string, string>; failWritePath?: string } = {}) {
  const files = over.files ?? {};
  const writes: Record<string, string> = {};
  const out: string[] = [];
  const err: string[] = [];
  const io: InstallIO = {
    readFile: (p) => files[p],
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

describe('runCiCliGunshi upgrade', () => {
  const OLD_SHA = '1'.repeat(40);
  const oldWorkflow = buildWorkflowYaml({ actionSha: OLD_SHA, actionVersion: '0.1.0' });

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

  it('when already pinned to the current sha, reports up to date and writes nothing', async () => {
    const current = buildWorkflowYaml({ actionSha: ACTION_SHA, actionVersion: ACTION_VERSION });
    const { io, writes, out } = fakeIO({ files: { [PATH]: current } });
    expect(await runCiCliGunshi(['upgrade'], io)).toBe(0);
    expect(writes).toEqual({});
    expect(out.join('\n')).toContain('already up to date');
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
