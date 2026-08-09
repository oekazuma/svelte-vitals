// Phase 2a of the gunshi migration (docs/superpowers/specs/2026-08-10-gunshi-cli-migration-design.md):
// the legacy `runDocsCli` (docs/cli.ts) stays in place and exported through Phase 3, so this file
// runs the same argv through it and through the gunshi/bone port (gunshi/docs.ts, now what
// `runCli(['docs', ...])` actually dispatches to) and asserts byte-for-byte equality — the same
// comparison technique the Phase 1 spike used (spike-gunshi-docs.test.ts), extended with the
// cells that only exist once help/`=false` are handled per-command instead of by a competing
// renderer.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { runDocsCli } from '../src/docs/cli.js';
import { runDocsCliGunshi } from '../src/gunshi/docs.js';
import { captureIO } from './helpers/capture-io.js';

function legacy(args: string[]) {
  const io = captureIO();
  const code = runDocsCli(args, io);
  return { code, out: io.out, err: io.err };
}

async function gunshi(args: string[]) {
  const io = captureIO();
  const code = await runDocsCliGunshi(args, io);
  return { code, out: io.out, err: io.err };
}

describe('gunshi/bone docs reproduces the legacy docs CLI, byte for byte', () => {
  const cells: { name: string; args: string[] }[] = [
    { name: 'list', args: ['list'] },
    { name: 'list --json', args: ['list', '--json'] },
    { name: 'show config', args: ['show', 'config'] },
    { name: 'show unknown', args: ['show', 'no-such-topic'] },
    { name: 'show rule-id redirect', args: ['show', 'seo/title-presence'] },
    { name: 'show rule-id redirect, rules/ prefix', args: ['show', 'rules/seo/title-presence'] },
    { name: 'list extra-arg', args: ['list', 'extra-arg'] },
    { name: 'show a b', args: ['show', 'a', 'b'] },
    { name: 'show (no name)', args: ['show'] },
    { name: 'no sub', args: [] },
    { name: 'bogus sub', args: ['bogus'] },
    { name: '--help', args: ['--help'] },
    { name: '-h', args: ['-h'] },
    { name: 'list --help (help wins over list logic, same as today)', args: ['list', '--help'] },
    { name: 'show --help (help wins over show logic, same as today)', args: ['show', '--help'] },
    { name: '-v (unrecognized, falls through to no-sub)', args: ['-v'] },
    { name: 'list -v (unrecognized flag ignored, list still runs)', args: ['list', '-v'] },
    { name: 'list --json=false (literal-false coercion)', args: ['list', '--json=false'] },
    {
      name: 'list --json --json=false (duplicate booleans are last-wins: off)',
      args: ['list', '--json', '--json=false']
    },
    {
      name: 'list --json=false --json (duplicate booleans are last-wins: on)',
      args: ['list', '--json=false', '--json']
    }
  ];

  for (const { name, args } of cells) {
    it(`${name}: identical to the legacy CLI`, async () => {
      expect(await gunshi(args)).toEqual(legacy(args));
    });
  }
});

describe('gate (c): in-process, injected IO, no process-global coupling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('never calls console.log/console.error/process.stdout.write/process.stderr.write on any path exercised above', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await gunshi(['list']);
    await gunshi(['show', 'config']);
    await gunshi(['show', 'no-such-topic']);
    await gunshi([]);
    await gunshi(['bogus']);
    await gunshi(['--help']);

    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(stdoutWrite).not.toHaveBeenCalled();
    expect(stderrWrite).not.toHaveBeenCalled();
  });
});
