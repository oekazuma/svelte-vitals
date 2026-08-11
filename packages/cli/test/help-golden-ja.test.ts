// ja `--help` design (docs/superpowers/specs/2026-08-11-cli-ja-help-design.md): new goldens, one
// per surface, under a resolved ja locale — mirrors help-golden.test.ts's five en cases exactly
// (same args, same assertions) so a reviewer can diff the two files side by side. The en goldens
// in help-golden.test.ts themselves must stay byte-identical; that invariant is pinned there, not
// here — this file only pins the NEW ja renders.
import { describe, it, expect } from 'vitest';
import { runCli } from '../src/cli.js';
import { captureIO } from './helpers/capture-io.js';

const JA_ENV = { SVELTE_VITALS_LANG: 'ja' };

async function cliJa(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const io = captureIO();
  const { code } = await runCli(args, io, JA_ENV);
  return { code, out: io.out, err: io.err };
}

describe('help goldens (ja)', () => {
  it('root --help', async () => {
    const { code, out, err } = await cliJa(['--help']);
    expect(code).toBe(0);
    expect({ out, err }).toMatchSnapshot();
  });

  it('docs --help', async () => {
    const { code, out, err } = await cliJa(['docs', '--help']);
    expect(code).toBe(0);
    expect({ out, err }).toMatchSnapshot();
  });

  it('explain --help', async () => {
    const { code, out, err } = await cliJa(['explain', '--help']);
    expect(code).toBe(0);
    expect({ out, err }).toMatchSnapshot();
  });

  it('install --help', async () => {
    const { code, out, err } = await cliJa(['install', '--help']);
    expect(code).toBe(0);
    expect({ out, err }).toMatchSnapshot();
  });

  it('ci --help', async () => {
    const { code, out, err } = await cliJa(['ci', '--help']);
    expect(code).toBe(0);
    expect({ out, err }).toMatchSnapshot();
  });
});
