// Phase 2b of the gunshi migration (docs/superpowers/specs/2026-08-10-gunshi-cli-migration-design.md):
// analyzer-specific regressions the shared cli-contract.test.ts/help-golden.test.ts suites don't
// already pin — see gunshi/analyze.ts's own doc comments for why each of these exists.
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cli } from 'gunshi/bone';
import { define } from 'gunshi/definition';
import { runCli } from '../src/cli.js';
import { captureIO } from './helpers/capture-io.js';

const here = dirname(fileURLToPath(import.meta.url));
const unitEntryFixtureDir = join(here, 'fixtures', 'unit-entry-project');

async function run(args: string[]) {
  const io = captureIO();
  const result = await runCli(args, io);
  return { ...result, out: io.out, err: io.err };
}

const dirs: string[] = [];
function tmpProjectDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'svelte-vitals-gunshi-analyze-'));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  while (dirs.length > 0) {
    const dir = dirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('root analyzer: single bone entry, no subCommands map', () => {
  it('ctx.commandPath is always [] and ctx.positionals needs no slicing (mirrors explain.ts, not docs.ts)', async () => {
    let captured: { positionals: string[]; commandPath: string[] } | undefined;
    const cmd = define({
      name: 'probe',
      args: {},
      run: (ctx) => {
        captured = { positionals: ctx.positionals, commandPath: ctx.commandPath };
      }
    });
    await cli(['./apps/web'], cmd, { name: 'probe' });
    expect(captured?.commandPath).toEqual([]);
    expect(captured?.positionals).toEqual(['./apps/web']);
  });
});

describe('unknown flags never swallow the analyzed path', () => {
  // args-tokens treats an UNDECLARED long/short option as string-like, consuming a following
  // positional as its own value — unlike node:util's parseArgs(strict:false), which treats the
  // same shape as boolean and leaves the positional alone (verified against both parsers).
  // gunshi/analyze.ts's stripUnknownFlags removes the unrecognized token before gunshi ever sees
  // it, so the follower always survives. cli-contract.test.ts's own 'unknown flag is silently
  // ignored' cell already pins the flag-before-path shape end to end; these add the reverse order
  // and a short-flag typo.
  it('an unknown flag after the path leaves the path alone', async () => {
    const dir = tmpProjectDir();
    const { code, err } = await run([dir, '--nonsense-flag']);
    expect(code).toBe(2);
    expect(err).not.toContain('nonsense-flag');
    expect(err).toContain('No SvelteKit project found');
  });

  it('an unknown short flag before the path leaves the path alone', async () => {
    const dir = tmpProjectDir();
    const { code, err } = await run(['-x', dir]);
    expect(code).toBe(2);
    expect(err).not.toContain('-x');
    expect(err).toContain('No SvelteKit project found');
  });

  it('a grouped short (-hv) keeps every known member — help wins, matching node:util strict:false', async () => {
    const { code, out } = await run(['-hv']);
    expect(code).toBe(0);
    expect(out).toContain('svelte-vitals — a deterministic SvelteKit code-health scanner');
  });

  it("-5 <path>: a digit-shaped unknown short is dropped like any other, not exempted — the path is analyzed, not swallowed as -5's value", async () => {
    const dir = tmpProjectDir();
    const { code, err } = await run(['-5', dir]);
    expect(code).toBe(2);
    expect(err).toContain('No SvelteKit project found');
  });

  it('--baseline --typo main: the unknown flag survives into the baseline shadow-parse, so it is still rejected as the (dash-prefixed) ref', async () => {
    // resolveArgs returns before ever reading the positional on this path (a fatal error short-
    // circuits before `cwd` is computed), so there's no separate observable surface for "the
    // positional wasn't lost" here — the fix's positional-preservation is pinned by the --diff
    // case below instead, which does reach cwd.
    const { code, err } = await run(['--baseline', '--typo', 'main']);
    expect(code).toBe(2);
    expect(err).toContain('--baseline requires a git ref');
  });
});

describe('neutralizeBareDiffAndBaseline: a stripped unknown flag never exposes a positional to a bare --diff/--baseline', () => {
  // Before the fix: stripUnknownFlags removing --typo left `unitEntryFixtureDir` sitting directly
  // after a bare --diff/--baseline in the argv gunshi parses, so gunshi consumed it as the flag's
  // own value instead of leaving it as the analyzed-path positional — the run silently fell back
  // to process.cwd() instead. Chdir to an empty tmpdir first so a lost positional is observable
  // (process.cwd() would then deterministically fail project detection) and a preserved one is
  // equally observable (the fixture project would be found and actually analyzed).
  const prevCwd = process.cwd();
  afterEach(() => process.chdir(prevCwd));

  it('--diff --typo <path>: the path survives as the positional, exactly like parseRunArgs', async () => {
    process.chdir(tmpProjectDir());
    const { code, err } = await run(['--diff', '--typo', unitEntryFixtureDir]);
    expect(err).not.toContain('No SvelteKit project found');
    expect(code).not.toBe(2);
  });

  it('a bare --diff alone is unaffected — still defaults to HEAD, still fails project detection the same way', async () => {
    process.chdir(tmpProjectDir());
    const { code, err } = await run(['--diff']);
    expect(code).toBe(2);
    expect(err).toContain('No SvelteKit project found');
  });

  it('--diff main (value form, no interfering unknown flag): main is still consumed as the ref, not the path', async () => {
    process.chdir(tmpProjectDir());
    const { code, err } = await run([unitEntryFixtureDir, '--diff', 'main']);
    // The explicit fixture path (before --diff) is the positional; 'main' is diff's value either
    // way — this only guards that neutralizing bare occurrences didn't also touch this shape.
    expect(err).not.toContain('No SvelteKit project found');
    expect(code).not.toBe(2);
  });
});

describe('-- terminator: everything after it is a literal positional, never a flag again', () => {
  // Before splitAtTerminator ran ahead of guard/strip: stripUnknownFlags treated the bare `--`
  // itself as an unknown long flag (name '') and dropped it, so gunshi never saw the terminator
  // and re-parsed what followed as real flags.
  // Both cells assert reporter-agnostically (out non-empty, never a bare score number) — the
  // reporter auto-detects from the environment (github under GITHUB_ACTIONS, agent under agent
  // envs), so a format-specific marker like 'Health:' would fail on CI while passing locally.
  it('<fixture> -- --score: --score is a literal positional, not reactivated — full report, not a bare number', async () => {
    const { code, out } = await run([unitEntryFixtureDir, '--', '--score']);
    expect(code).toBe(1);
    expect(out).not.toMatch(/^\d+$/);
    expect(out.length).toBeGreaterThan(0);
  });

  it('<fixture> -- --reporter: nothing silent — a full report prints, not a bare exit 2', async () => {
    // Before the fix: guardArgs fired on the post-`--` `--reporter` token (missing value), then
    // the wording fallback re-parsed via parseRunArgs, which honors `--` and found no error — so
    // nothing printed at all, yet the guard branch still forced exit 2.
    const { code, out } = await run([unitEntryFixtureDir, '--', '--reporter']);
    expect(code).not.toBe(2);
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('--score --score=false: last-wins through the real dispatch path', () => {
  it('a trailing =false turns --score off (falls through to the normal reporter path)', async () => {
    const dir = tmpProjectDir();
    const { code, err } = await run([dir, '--score', '--score=false']);
    // --score off means no "--score overrides --reporter" warning path is even reachable here;
    // the run still fails on project detection, proving --score itself did not stay on (a
    // literal score run prints only a number, never this message).
    expect(code).toBe(2);
    expect(err).toContain('No SvelteKit project found');
  });
});

describe('--help wins over a guard-detected error (help is checked before the guard fallback)', () => {
  it('--help --reporter= prints help and exits 0, exactly like today', async () => {
    const { code, out, err } = await run(['--help', '--reporter=']);
    expect(code).toBe(0);
    expect(out).toContain('svelte-vitals — a deterministic SvelteKit code-health scanner');
    expect(err).toBe('');
  });
});
