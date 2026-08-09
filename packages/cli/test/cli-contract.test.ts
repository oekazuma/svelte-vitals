// Phase 0 of the gunshi migration (docs/superpowers/specs/2026-08-10-gunshi-cli-migration-design.md):
// pins the bin-level guard class and dispatch quirks through the real `runCli` seam, one
// representative per class. `resolve-args.test.ts` (59 cases) already owns the exhaustive
// per-flag matrix at the `resolveArgs` layer — this file does not duplicate it; it only proves
// the same guard reaches an end user through the full dispatch, with the right exit code and
// stdout/stderr shape.
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli, type CliResult } from '../src/cli.js';
import { captureIO } from './helpers/capture-io.js';

async function cli(args: string[]): Promise<CliResult & { out: string; err: string }> {
  const io = captureIO();
  const result = await runCli(args, io);
  return { ...result, out: io.out, err: io.err };
}

const dirs: string[] = [];
function tmpProjectDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'svelte-vitals-cli-contract-'));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  while (dirs.length > 0) {
    const dir = dirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('unknown/malformed flags', () => {
  it('an unknown flag is silently ignored, not rejected — parseArgs(strict:false) passthrough', async () => {
    // A non-project dir gives a deterministic, unrelated exit-2 reason; the assertion is that
    // NOTHING about '--nonsense-flag' appears in stderr, proving it was never even inspected.
    const dir = tmpProjectDir();
    const { code, err, exit } = await cli(['--nonsense-flag', dir]);
    expect(code).toBe(2);
    expect(exit).toBe('immediate');
    expect(err).not.toContain('nonsense-flag');
    expect(err).toContain('No SvelteKit project found');
  });

  it('an unknown value for an enum flag (--reporter) is a fatal argv error', async () => {
    const { code, out, err, exit } = await cli(['--reporter', 'nope']);
    expect(code).toBe(2);
    expect(exit).toBe('immediate');
    expect(out).toBe('');
    expect(err).toContain("unknown reporter 'nope'");
  });

  it('--reporter= (empty value) is rejected by both the value guard and the enum check', async () => {
    const { code, out, err } = await cli(['--reporter=']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain('svelte-vitals: --reporter requires a value.');
    expect(err).toContain("unknown reporter ''");
  });

  it('--reporter followed by another flag consumes it as the value, then rejects it', async () => {
    const { code, out, err } = await cli(['--reporter', '--json']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain('svelte-vitals: --reporter requires a value.');
    expect(err).toContain("unknown reporter '--json'");
  });
});

describe('--out-file accepts the literal stdout marker', () => {
  it('--out-file - is accepted (fails later, for an unrelated project-detection reason)', async () => {
    const dir = tmpProjectDir();
    const { code, err } = await cli(['--out-file', '-', dir]);
    expect(code).toBe(2);
    expect(err).not.toContain('--out-file requires a value');
    expect(err).toContain('No SvelteKit project found');
  });

  it('--out-file=- is accepted the same way', async () => {
    const dir = tmpProjectDir();
    const { code, err } = await cli([`--out-file=-`, dir]);
    expect(code).toBe(2);
    expect(err).not.toContain('--out-file requires a value');
    expect(err).toContain('No SvelteKit project found');
  });
});

describe('--min-health', () => {
  it('rejects a non-numeric value', async () => {
    const { code, out, err } = await cli(['--min-health', 'abc']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain("invalid --min-health 'abc'; expected a number 0-100.");
  });

  it('rejects an out-of-range value', async () => {
    const { code, out, err } = await cli(['--min-health', '150']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain("invalid --min-health '150'; expected a number 0-100.");
  });
});

describe('--rules x --category conflict', () => {
  it('a --rules id excluded by --category is a fatal error', async () => {
    const { code, out, err } = await cli(['--rules', 'seo/title-presence', '--category', 'performance']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain('--rules id(s) excluded by --category performance: seo/title-presence');
  });
});

describe('docs show', () => {
  it('an unknown topic prints the generic error, stdout empty', async () => {
    const { code, out, err } = await cli(['docs', 'show', 'no-such-topic']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain("unknown docs topic 'no-such-topic'");
  });

  it('a rule id redirects to `explain` instead of the generic error, stdout empty', async () => {
    const { code, out, err } = await cli(['docs', 'show', 'seo/title-presence']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain("'seo/title-presence' is a rule, not a docs topic");
    expect(err).toContain('svelte-vitals explain seo/title-presence');
  });
});

describe('explain', () => {
  it('an unknown rule id errors, stdout empty', async () => {
    const { code, out, err } = await cli(['explain', 'not/a-rule']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain("unknown rule id 'not/a-rule'");
  });
});

describe('subcommand-vs-path dispatch', () => {
  it('the literal `docs` positional routes to the subcommand', async () => {
    const { code, out } = await cli(['docs', 'list']);
    expect(code).toBe(0);
    expect(out).toContain('Topics');
  });

  it('a `./docs`-style path is not the subcommand — it falls through to the analyzer', async () => {
    const dir = tmpProjectDir();
    const prevCwd = process.cwd();
    process.chdir(dir);
    try {
      const { code, out, err, exit } = await cli(['./docs']);
      expect(code).toBe(2);
      expect(exit).toBe('immediate');
      expect(out).toBe('');
      expect(err).toContain('No SvelteKit project found');
    } finally {
      process.chdir(prevCwd);
    }
  });
});

describe('ci/install exit-2 surfaces', () => {
  it('ci with an unknown sub-subcommand prints CI_HELP to stdout and exits 2 (not the docs/explain empty-stdout contract)', async () => {
    const { code, out, err } = await cli(['ci', 'bogus']);
    expect(code).toBe(2);
    // Unlike docs/explain, ci's non-help error path writes its help text via `io.log` (stdout),
    // not `io.errorLog` — a real quirk this suite pins as-is rather than smoothing over.
    expect(out).toContain('svelte-vitals ci — scaffold CI integration');
    expect(err).toBe('');
  });

  it('install with an unknown --client value warns per-value then fails fatally, exit 2', async () => {
    const { code, out, err } = await cli(['install', '--client', 'bogus']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain("unknown --client 'bogus'");
    expect(err).toContain('no valid --client values');
  });
});
