// See gunshi-docs-parity.test.ts's own header for why this is a snapshot-pin suite, not a live
// comparison against the legacy `runExplainCli` (deleted in Phase 3, explain.ts's own dispatcher).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { runExplainCliGunshi } from '../src/gunshi/explain.js';
import { captureIO } from './helpers/capture-io.js';

async function gunshi(args: string[]) {
  const io = captureIO();
  const code = await runExplainCliGunshi(args, io);
  return { code, out: io.out, err: io.err };
}

describe('gunshi/bone explain — pinned behavior across the argv-shape matrix', () => {
  const cells: { name: string; args: string[] }[] = [
    { name: 'known rule id', args: ['seo/title-presence'] },
    { name: 'configurable rule id', args: ['seo/title-length'] },
    { name: '--json <id>', args: ['--json', 'seo/title-length'] },
    { name: 'json --list', args: ['--list', '--json'] },
    { name: '--list', args: ['--list'] },
    { name: '--list extra-arg (rejected)', args: ['--list', 'extra-arg'] },
    { name: 'no id', args: [] },
    { name: 'unknown id', args: ['NOPE999'] },
    { name: 'wrong-case id (exact match only)', args: ['SEO/TITLE-PRESENCE'] },
    { name: 'id plus extra positionals (legacy ignores them)', args: ['seo/title-presence', 'extra'] },
    { name: '--help', args: ['--help'] },
    { name: '-h', args: ['-h'] },
    { name: '--json=false (literal-false coercion)', args: ['--json=false', 'seo/title-length'] },
    { name: '--list=false (literal-false coercion, falls through to no-id)', args: ['--list=false'] },
    // Phase 2b (docs/superpowers/specs/2026-08-10-gunshi-cli-migration-design.md): an unknown
    // flag directly before the rule-id positional — args-tokens would otherwise consume the id as
    // that undeclared flag's own value.
    { name: '--typo <id> (unknown long flag before the positional)', args: ['--typo', 'seo/title-presence'] },
    { name: '-x <id> (unknown short flag before the positional)', args: ['-x', 'seo/title-presence'] },
    { name: '-- --typo (terminator: a literal, unknown rule id)', args: ['--', '--typo'] }
  ];

  for (const { name, args } of cells) {
    it(`${name}`, async () => {
      expect(await gunshi(args)).toMatchSnapshot();
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

    await gunshi(['seo/title-presence']);
    await gunshi(['--list']);
    await gunshi(['NOPE999']);
    await gunshi([]);
    await gunshi(['--help']);

    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(stdoutWrite).not.toHaveBeenCalled();
    expect(stderrWrite).not.toHaveBeenCalled();
  });
});
