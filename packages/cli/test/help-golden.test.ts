// Phase 0 of the gunshi migration (docs/superpowers/specs/2026-08-10-gunshi-cli-migration-design.md):
// pins every command surface's help/version output before any gunshi code exists, so a Phase 2
// diff review is a snapshot diff against this file. Update these snapshots only for a deliberate,
// declared help-format change — never to make a CI failure go away.
import { describe, it, expect } from 'vitest';
import { runCli } from '../src/cli.js';
import { captureIO } from './helpers/capture-io.js';

async function cli(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const io = captureIO();
  const { code } = await runCli(args, io);
  return { code, out: io.out, err: io.err };
}

describe('help goldens', () => {
  it('root --help', async () => {
    const { code, out, err } = await cli(['--help']);
    expect(code).toBe(0);
    expect({ out, err }).toMatchSnapshot();
  });

  it('docs --help', async () => {
    const { code, out, err } = await cli(['docs', '--help']);
    expect(code).toBe(0);
    expect({ out, err }).toMatchSnapshot();
  });

  it('explain --help', async () => {
    const { code, out, err } = await cli(['explain', '--help']);
    expect(code).toBe(0);
    expect({ out, err }).toMatchSnapshot();
  });

  it('install --help', async () => {
    const { code, out, err } = await cli(['install', '--help']);
    expect(code).toBe(0);
    expect({ out, err }).toMatchSnapshot();
  });

  it('ci --help', async () => {
    const { code, out, err } = await cli(['ci', '--help']);
    expect(code).toBe(0);
    expect({ out, err }).toMatchSnapshot();
  });

  it('--version', async () => {
    const { code, out, err } = await cli(['--version']);
    expect(code).toBe(0);
    // Normalized: the CLI/core version numbers bump on every release (Changesets), and a raw
    // snapshot would fail every Version Packages PR with no drift in the format to review.
    expect({
      out: out.replace(/\d+\.\d+\.\d+(?:-[\w.]+)?/g, 'X.Y.Z'),
      err
    }).toMatchSnapshot();
  });
});

// Deliberately not pinned here: the no-args-in-a-non-project error surface. Under vitest, argv-less
// dispatch falls back to `process.cwd()` (packages/cli), which isn't a SvelteKit project itself but
// whose subtree holds dozens of fixture kit apps — `run()`'s monorepo auto-discovery finds several
// and its behavior forks on `process.stdin/stdout.isTTY`, neither of which this seam lets a caller
// override. That branch is TTY-dependent, not CLI-dependent, so it isn't a fair characterization
// target. The same "not a SvelteKit project" surface is pinned deterministically by
// cli-contract.test.ts's `./docs`-style-path and by scripts/cli-e2e.mjs's non-project-dir check,
// both of which control cwd explicitly instead of relying on discovery.
