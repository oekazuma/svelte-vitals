// Phase 2b of the gunshi migration (docs/superpowers/specs/2026-08-10-gunshi-cli-migration-design.md):
// analyzer-specific regressions the shared cli-contract.test.ts/help-golden.test.ts suites don't
// already pin — see gunshi/analyze.ts's own doc comments for why each of these exists.
import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cli } from 'gunshi/bone';
import { define } from 'gunshi/definition';
import { runCli } from '../src/cli.js';
import { shadowParseDiffAndBaseline } from '../src/gunshi/analyze.js';
import { captureIO } from './helpers/capture-io.js';

const here = dirname(fileURLToPath(import.meta.url));
const unitEntryFixtureDir = join(here, 'fixtures', 'unit-entry-project');

async function run(args: string[]) {
  const io = captureIO();
  // Locale-free env, same reason as help-golden.test.ts: cells asserting en help output
  // must not inherit the runner's shell locale.
  const result = await runCli(args, io, {});
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

// did-you-mean addendum (design doc): a mistyped sub-command name falls through to the root
// analyzer as a path (cli.ts's dispatch is exact-match only) — gunshi/analyze.ts appends one hint
// line to the existing not-a-project message when, and only when, the token resolves to nothing on
// disk AND is within the shared matcher's default distance of a real sub-command name.
describe('did-you-mean: a mistyped sub-command falling through to the analyzer path', () => {
  const prevCwd = process.cwd();
  afterEach(() => process.chdir(prevCwd));

  it("svelte-vitals isntall: appends the hint after the existing 'No SvelteKit project found' message", async () => {
    process.chdir(tmpProjectDir());
    const { code, err } = await run(['isntall']);
    expect(code).toBe(2);
    expect(err).toContain('No SvelteKit project found');
    expect(err).toContain('svelte-vitals: did you mean `svelte-vitals install`?');
  });

  it('svelte-vitals xyzzyplugh: garbage input past the default distance threshold gets no hint', async () => {
    process.chdir(tmpProjectDir());
    const { code, err } = await run(['xyzzyplugh']);
    expect(code).toBe(2);
    expect(err).toContain('No SvelteKit project found');
    expect(err).not.toContain('did you mean');
  });

  it('an existing directory with a close name is analyzed as-is, never redirected to the hint', async () => {
    const cwd = tmpProjectDir();
    mkdirSync(join(cwd, 'isntall'));
    process.chdir(cwd);
    const { code, err } = await run(['isntall']);
    expect(code).toBe(2);
    expect(err).toContain('No SvelteKit project found');
    expect(err).not.toContain('did you mean');
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

// Unit pins for shadowParseDiffAndBaseline's value shapes (measured, not assumed — the `--diff
// --typo main` cell in particular does NOT consume `--typo` the way `--baseline --typo main`
// does: the bare-`--diff` rewrite fires first because `--typo` looks like a flag, so `--diff`
// never reaches the raw parse as a bare trailing token). Each cell is one assertion so a broken
// shape fails on its own cell, not a shared multi-assertion block. The bare-`--diff` cell is the
// one the `--diff=HEAD` rewrite exists for: drop that rewrite and this cell alone catches it
// (`values.diff` becomes the boolean `true`, not the string `'HEAD'`) — the git-fixture test below
// pins what that divergence does to a real run instead of just the parsed value.
describe('shadowParseDiffAndBaseline: pinned value shapes', () => {
  it('neither flag passed: both undefined', () => {
    expect(shadowParseDiffAndBaseline([])).toEqual({ diff: undefined, baseline: undefined });
  });

  it('bare --diff: defaults to HEAD', () => {
    expect(shadowParseDiffAndBaseline(['--diff']).diff).toBe('HEAD');
  });

  it('--diff main: the ref, not the default', () => {
    expect(shadowParseDiffAndBaseline(['--diff', 'main']).diff).toBe('main');
  });

  it('--diff=: empty string, not the default (a distinct, explicit shape)', () => {
    expect(shadowParseDiffAndBaseline(['--diff=']).diff).toBe('');
  });

  it('--diff --typo main: the bare-rewrite fires on the dash-leading follower, so diff is HEAD (not a consumed --typo)', () => {
    expect(shadowParseDiffAndBaseline(['--diff', '--typo', 'main']).diff).toBe('HEAD');
  });

  it('bare --baseline: the boolean marker true, not a string (resolveArgs treats this as fatal)', () => {
    expect(shadowParseDiffAndBaseline(['--baseline']).baseline).toBe(true);
  });

  it('--baseline main: the ref', () => {
    expect(shadowParseDiffAndBaseline(['--baseline', 'main']).baseline).toBe('main');
  });

  it('--baseline --typo main: --baseline has no bare-rewrite, so it consumes the dash-leading follower literally', () => {
    expect(shadowParseDiffAndBaseline(['--baseline', '--typo', 'main']).baseline).toBe('--typo');
  });

  it('--baseline=: empty string', () => {
    expect(shadowParseDiffAndBaseline(['--baseline=']).baseline).toBe('');
  });
});

// Observable-level integration test (not just the parsed value): proves --diff's scoping actually
// changes which findings are reported, end to end, through a real git repo. Discriminates the
// exact mutation the unit pins above catch structurally: if the `--diff=HEAD` rewrite is dropped,
// `resolveArgs` sees a non-string `diff` and drops scoping entirely — the run silently falls back
// to analyzing every route instead of erroring, so a naive "--diff ran and produced output"
// assertion can't see the bug (the pre-existing gunshi-guard/cli-contract cells for bare --diff
// only ever ran against a non-project tmpdir, whose "No SvelteKit project found" exit-2 doesn't
// depend on the diff value at all).
describe('--diff actually scopes findings, not just parses (git fixture)', () => {
  const dirs: string[] = [];
  afterEach(() => {
    while (dirs.length > 0) {
      const dir = dirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  function git(args: string[], cwd: string): void {
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  }

  /**
   * A committed baseline with ONE pre-existing seo/title-presence finding (home, untouched by the
   * diff) and one clean route (other), then an UNCOMMITTED edit that removes other's title too —
   * a second, real finding that only a --diff run scoped to the actual change should report.
   * A run that silently fell back to analyzing everything would report both.
   */
  function makeFixtureRepo(): string {
    const dir = mkdtempSync(join(tmpdir(), 'svelte-vitals-diff-scope-'));
    dirs.push(dir);
    git(['init'], dir);
    git(['config', 'user.email', 'test@example.com'], dir);
    git(['config', 'user.name', 'Test'], dir);
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'diff-scope-fixture', private: true, devDependencies: { '@sveltejs/kit': '^2.0.0' } })
    );
    mkdirSync(join(dir, 'src/routes/other'), { recursive: true });
    writeFileSync(join(dir, 'src/routes/+page.svelte'), '<h1>Home</h1>\n'); // pre-existing defect, never touched
    writeFileSync(
      join(dir, 'src/routes/other/+page.svelte'),
      '<svelte:head><title>Other</title></svelte:head>\n<h1>Other</h1>\n'
    );
    git(['add', '.'], dir);
    git(['commit', '-m', 'init'], dir);

    // Uncommitted change: drop other's title, introducing the ONE finding a --diff run must catch.
    writeFileSync(join(dir, 'src/routes/other/+page.svelte'), '<h1>Other</h1>\n');
    return dir;
  }

  it('reports only the changed route’s new finding, not the untouched route’s pre-existing one', async () => {
    const dir = makeFixtureRepo();
    const { code, out, err } = await run([dir, '--diff', '--reporter', 'json']);
    expect(code).toBe(1); // a critical finding (seo/title-presence) is present
    expect(err).toBe('');
    const report = JSON.parse(out) as { rules: Record<string, { findings: number }> };
    // Exactly the changed route's finding — the untouched home route's pre-existing one must not
    // leak in. If diff-scoping silently fell back to a full scan (the mutation this test exists
    // to catch), this would be 2.
    expect(report.rules['seo/title-presence']?.findings).toBe(1);
  });

  it('the same fixture without --diff reports both findings (the scoped run above really did narrow it)', async () => {
    const dir = makeFixtureRepo();
    const { code, out, err } = await run([dir, '--reporter', 'json']);
    expect(code).toBe(1);
    expect(err).toBe('');
    const report = JSON.parse(out) as { rules: Record<string, { findings: number }> };
    expect(report.rules['seo/title-presence']?.findings).toBe(2);
  });
});
