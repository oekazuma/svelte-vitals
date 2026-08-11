// Phase 3 of the gunshi migration (docs/superpowers/specs/2026-08-10-gunshi-cli-migration-design.md):
// `ci` (gunshi/ci.ts) ported directly to gunshi/bone — the CRUD-level behavior (install/upgrade
// writing the workflow file) is exercised in test/ci/cli.test.ts against a fake `InstallIO`; this
// file pins the argv-shape matrix at the dispatch layer, the same technique gunshi-docs-parity.ts/
// gunshi-explain-parity.ts use, but without a surviving legacy oracle to diff against (there was
// no Phase-2a comparison period for `ci` — it went straight from legacy to gunshi in this phase).
//
// The key discriminator this file exists to pin: the outer `ci`/`install`/`upgrade` split is a
// literal `args[0]` string compare, exactly like the legacy dispatcher — NOT run through
// `guardArgs`/`stripUnknownFlags` first. Those don't understand argv *position*, only flag shapes,
// so promoting/stripping ahead of the split would dispatch shapes the legacy runner never did:
// `ci -- install` would actually run install instead of printing help and exiting 2; `ci --bogus
// install` would drop `--bogus` and run install — writing a file where legacy touched nothing.
import { describe, it, expect } from 'vitest';
import { runCiCliGunshi } from '../src/gunshi/ci.js';
import type { InstallIO } from '../src/install/index.js';

async function ci(args: string[], files: Record<string, string> = {}) {
  const writes: Record<string, string> = {};
  const out: string[] = [];
  const err: string[] = [];
  const io: InstallIO = {
    readFile: (p) => files[p],
    writeFile: (p, c) => {
      writes[p] = c;
    },
    cwd: '/proj',
    isTTY: false,
    log: (l) => out.push(l),
    errorLog: (l) => err.push(l)
  };
  const code = await runCiCliGunshi(args, io);
  return { code, out: out.join('\n'), err: err.join('\n'), wrote: Object.keys(writes).length > 0 };
}

describe('gunshi/bone ci — pinned behavior across the argv-shape matrix', () => {
  const cells: { name: string; args: string[] }[] = [
    { name: 'no sub (bare ci)', args: [] },
    { name: '--help', args: ['--help'] },
    { name: '-h', args: ['-h'] },
    { name: 'bogus sub', args: ['bogus'] },
    // did-you-mean addendum (design doc): a close typo of a real sub-subcommand name.
    { name: 'isntall (typo of install, close enough for a did-you-mean hint)', args: ['isntall'] },
    { name: 'install', args: ['install'] },
    { name: 'install --dry-run', args: ['install', '--dry-run'] },
    { name: 'install --help', args: ['install', '--help'] },
    { name: 'upgrade (no workflow file)', args: ['upgrade'] },
    { name: 'upgrade --help', args: ['upgrade', '--help'] },
    { name: 'upgrade --dry-run (no workflow file)', args: ['upgrade', '--dry-run'] },
    // Discriminators for the dispatch shape described in this file's header comment — every one
    // of these must dispatch exactly like `args[0]` string comparison would, never like a
    // promoted/stripped gunshi parse.
    { name: '-- install (terminator: sub is the literal token "--", not promoted)', args: ['--', 'install'] },
    {
      name: '--bogus install (unknown flag NOT stripped ahead of the sub-command split)',
      args: ['--bogus', 'install']
    },
    { name: '--force --help (sub is the literal token "--force", not a flag)', args: ['--force', '--help'] }
  ];

  for (const { name, args } of cells) {
    it(`${name}`, async () => {
      expect(await ci(args)).toMatchSnapshot();
    });
  }
});

describe('the declared movement: ci stdout→stderr on exit-2 paths', () => {
  it('bare `ci` leaves stdout empty', async () => {
    const { code, out, err } = await ci([]);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain('svelte-vitals ci install');
  });

  it('an unknown sub-subcommand leaves stdout empty', async () => {
    const { code, out, err } = await ci(['bogus']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain('Usage:');
  });
});

// did-you-mean addendum (design doc): appended ahead of the existing CI_HELP dump, never replacing
// it — CI_HELP has no per-token "unknown sub-subcommand 'x'" line of its own to append after.
describe('did-you-mean: ci <bogus sub-subcommand>', () => {
  it('a close typo of install gets a hint', async () => {
    const { code, err } = await ci(['isntall']);
    expect(code).toBe(2);
    expect(err).toContain('svelte-vitals: did you mean `svelte-vitals ci install`?');
    expect(err).toContain('Usage:'); // CI_HELP still prints in full — additive, not a replacement.
  });

  it('"bogus" is far enough from install/upgrade that no hint is added', async () => {
    const { err } = await ci(['bogus']);
    expect(err).not.toContain('did you mean');
  });

  it('a bare `ci` has no typed token to suggest against — no hint', async () => {
    const { err } = await ci([]);
    expect(err).not.toContain('did you mean');
  });
});
