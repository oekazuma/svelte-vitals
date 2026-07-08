import { describe, it, expect } from 'vitest';
import { runCiCli } from '../../src/ci/cli.js';
import { WORKFLOW_PATH } from '../../src/ci/workflow.js';
import type { InstallIO } from '../../src/install/index.js';

function fakeIO(over: { files?: Record<string, string>; failWritePath?: string } = {}): {
  io: InstallIO;
  writes: Record<string, string>;
  out: string[];
  err: string[];
} {
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
    home: '/home/u',
    isTTY: false,
    log: (l) => out.push(l),
    errorLog: (l) => err.push(l)
  };
  return { io, writes, out, err };
}

const PATH = `/proj/${WORKFLOW_PATH}`;

describe('runCiCli', () => {
  it('with no subcommand prints help and exits 2', async () => {
    const { io, out } = fakeIO();
    expect(await runCiCli([], io)).toBe(2);
    expect(out.join('\n')).toContain('svelte-vitals ci install');
  });

  it('unknown subcommand prints help and exits 2', async () => {
    const { io, out } = fakeIO();
    expect(await runCiCli(['bogus'], io)).toBe(2);
    expect(out.join('\n')).toContain('Usage:');
  });

  it('`ci --help` prints help and exits 0', async () => {
    const { io, out } = fakeIO();
    expect(await runCiCli(['--help'], io)).toBe(0);
    expect(out.join('\n')).toContain('svelte-vitals ci install');
  });

  it('`ci install --help` prints help and exits 0 without writing', async () => {
    const { io, out, writes } = fakeIO();
    expect(await runCiCli(['install', '--help'], io)).toBe(0);
    expect(out.join('\n')).toContain('Usage:');
    expect(writes).toEqual({});
  });

  it('dry-run previews the plan and writes nothing', async () => {
    const { io, out, writes } = fakeIO();
    expect(await runCiCli(['install', '--dry-run'], io)).toBe(0);
    expect(writes).toEqual({});
    expect(out.join('\n')).toContain('Dry run — no files written.');
    expect(out.join('\n')).toContain('[created]');
  });

  it('writes the workflow file when none exists', async () => {
    const { io, writes, out } = fakeIO();
    expect(await runCiCli(['install'], io)).toBe(0);
    expect(Object.keys(writes)).toEqual([PATH]);
    expect(writes[PATH]).toContain('name: svelte-vitals');
    expect(out.join('\n')).toContain('Done.');
  });

  it('an existing file is left alone (status exists) without --force', async () => {
    const { io, writes, out } = fakeIO({ files: { [PATH]: 'name: old\n' } });
    expect(await runCiCli(['install'], io)).toBe(0);
    expect(writes).toEqual({});
    expect(out.join('\n')).toContain('already installed');
  });

  it('--force overwrites an existing file', async () => {
    const { io, writes } = fakeIO({ files: { [PATH]: 'name: old\n' } });
    expect(await runCiCli(['install', '--force'], io)).toBe(0);
    expect(writes[PATH]).toContain('name: svelte-vitals');
  });

  it('returns exit 2 and logs an error when writing fails', async () => {
    const { io, err } = fakeIO({ failWritePath: PATH });
    expect(await runCiCli(['install'], io)).toBe(2);
    expect(err.join('\n')).toContain('failed to write');
  });
});
