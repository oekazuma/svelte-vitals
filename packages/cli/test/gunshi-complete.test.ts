// Shell completion (docs/superpowers/specs/2026-08-10-gunshi-cli-migration-design.md addendum):
// `@gunshi/plugin-completion` wired as a dedicated `complete` entry (src/gunshi/complete.ts),
// dispatched by `runCli` (cli.ts) before the analyzer fallback, mirroring `docs`/`explain`/
// `install`/`ci`. Unlike those four, `@bomb.sh/tab` (the plugin's completion engine) writes
// candidates/scripts via raw `console.log`, bypassing the injected `CliIO` entirely — confirmed
// empirically, so success paths here spy on `console.log` rather than `captureIO()`; only this
// file's own pre-`cli()` shell-name guard (the failure paths) goes through `io.errorLog`.
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { runCli } from '../src/cli.js';
import { runCompleteCliGunshi } from '../src/gunshi/complete.js';
import { ROOT_ARGS } from '../src/gunshi/analyze.js';
import { INSTALL_ARGS } from '../src/gunshi/install.js';
import { captureIO } from './helpers/capture-io.js';

const SHELLS = ['bash', 'zsh', 'fish', 'powershell'] as const;

/**
 * Joins every `console.log` call's first argument — bombshell logs one line (or one full script)
 * per call. `vi.spyOn` returns the SAME mock on repeat calls within a test (the property is
 * already replaced), so this clears prior calls first — otherwise a second `spyLog()`/`candidates()`
 * in the same `it` would see earlier queries' output too.
 */
function spyLog() {
  const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
  spy.mockClear();
  return {
    calls: () => spy.mock.calls.map((c) => String(c[0])).join('\n'),
    restore: () => spy.mockRestore()
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('complete: missing/unknown shell is a fatal error, not silent', () => {
  it('bare `complete` (no shell, no --) exits 2 with a naming error, stdout untouched', async () => {
    const log = spyLog();
    const io = captureIO();
    const code = await runCompleteCliGunshi(['complete'], io);
    expect(code).toBe(2);
    expect(io.out).toBe('');
    expect(io.err).toContain('complete needs a shell name');
    expect(log.calls()).toBe('');
  });

  it('an unsupported shell name exits 2 naming the ones that ARE supported', async () => {
    const io = captureIO();
    const code = await runCompleteCliGunshi(['complete', 'tcsh'], io);
    expect(code).toBe(2);
    expect(io.out).toBe('');
    expect(io.err).toContain("unknown shell 'tcsh'");
    expect(io.err).toContain('bash, zsh, fish, powershell');
  });
});

describe('complete <shell>: prints a non-empty setup script for every supported shell', () => {
  for (const shell of SHELLS) {
    it(shell, async () => {
      const log = spyLog();
      const io = captureIO();
      const code = await runCompleteCliGunshi(['complete', shell], io);
      expect(code).toBe(0);
      expect(io.out).toBe('');
      expect(io.err).toBe('');
      expect(log.calls().length).toBeGreaterThan(100);
      expect(log.calls()).toContain('svelte-vitals');
    });
  }
});

describe('complete -- <words>: candidate protocol the generated scripts call back with', () => {
  /** Runs the candidate query and returns just the candidate values (drops descriptions and the trailing `:<directive>` line). */
  async function candidates(words: string[]): Promise<string[]> {
    const log = spyLog();
    const code = await runCompleteCliGunshi(['complete', '--', ...words], captureIO());
    expect(code).toBe(0);
    return log
      .calls()
      .split('\n')
      .filter((l) => l.includes('\t'))
      .map((l) => l.split('\t')[0]!);
  }

  it('top-level: every sub-command family is offered', async () => {
    expect(await candidates([''])).toEqual(['docs', 'explain', 'install', 'ci']);
  });

  it('root flags: a sample of real flags, kebab-cased even for toKebab camelCase keys', async () => {
    const list = await candidates(['--']);
    expect(list).toEqual(expect.arrayContaining(['--route', '--reporter', '--score', '--help']));
    // Pins the toKebab fix (gunshi/complete.ts's `forCompletion`): the plugin registers flags off
    // the raw object key with no `toKebab` awareness — ROOT_ARGS declares these three under
    // camelCase keys precisely so gunshi's OWN renderer doesn't mis-render `--no-*` (analyze.ts's
    // own doc comment); left unmirrored, completion would offer `--noSuppressions` etc. instead.
    expect(list).toEqual(expect.arrayContaining(['--no-suppressions', '--no-color', '--no-animation']));
  });

  it('root flags: value completion for the enum-ish flags matches their real accepted values', async () => {
    expect(await candidates(['--reporter', ''])).toEqual(['console', 'json', 'agent', 'sarif', 'github', 'html', 'md']);
    expect(await candidates(['--fail-on', ''])).toEqual(['critical', 'warning', 'info']);
    expect(await candidates(['--category', ''])).toEqual([
      'seo',
      'performance',
      'correctness',
      'security',
      'architecture',
      'a11y'
    ]);
    expect(await candidates(['--treat-dynamic-as', ''])).toEqual(['pass', 'warn', 'fail']);
  });

  it('docs: list/show sub-commands', async () => {
    expect(await candidates(['docs', ''])).toEqual(['list', 'show']);
  });

  it('explain: --list/--json/--help', async () => {
    expect(await candidates(['explain', '--'])).toEqual(['--list', '--json', '--help']);
  });

  it("install: every real flag, but never the hidden obsolete '--scope'", async () => {
    const list = await candidates(['install', '--']);
    expect(list).toEqual(['--client', '--app', '--yes', '--dry-run', '--force', '--refresh', '--help']);
    expect(list).not.toContain('--scope');
  });

  it('ci install: force/dry-run/help', async () => {
    expect(await candidates(['ci', 'install', '--'])).toEqual(['--force', '--dry-run', '--help']);
  });

  it("ci upgrade: only its real subset (no --force — it doesn't strip one, matches gunshi/ci.ts's CI_UPGRADE_ARGS)", async () => {
    expect(await candidates(['ci', 'upgrade', '--'])).toEqual(['--dry-run', '--help']);
  });

  /** Like `candidates()` but keeps the full `value\tdescription` line — needed to inspect description text and to catch a multi-line description's continuation lines leaking in as their own bogus, tab-less "candidates". */
  async function candidateLines(words: string[]): Promise<string[]> {
    const log = spyLog();
    const code = await runCompleteCliGunshi(['complete', '--', ...words], captureIO());
    expect(code).toBe(0);
    return log.calls().split('\n');
  }

  it('install: every line is a real candidate or the trailing directive — a multi-line description (e.g. --client) never leaks its continuation lines as their own candidates', async () => {
    const lines = await candidateLines(['install', '--']);
    const directive = lines.at(-1)!;
    expect(directive).toMatch(/^:\d+$/);
    const body = lines.slice(0, -1).filter((l) => l.length > 0);
    for (const line of body) expect(line).toContain('\t');
    const nonHiddenFlags = Object.values(INSTALL_ARGS).filter((schema) => !('hidden' in schema && schema.hidden));
    expect(body).toHaveLength(nonHiddenFlags.length);
  });

  it('root flags: --no-* candidates carry their real description, not the bare stripped key ("color"/"animation"/"suppressions")', async () => {
    const lines = await candidateLines(['--']);
    const descriptionOf = (flag: string) => lines.find((l) => l.startsWith(`${flag}\t`))?.slice(flag.length + 1);
    expect(descriptionOf('--no-color')).toBe(ROOT_ARGS.noColor.description);
    expect(descriptionOf('--no-animation')).toBe(ROOT_ARGS.noAnimation.description);
    expect(descriptionOf('--no-suppressions')).toBe(ROOT_ARGS.noSuppressions.description);
    // Pins that the phantom base-key entries forCompletion adds to satisfy the plugin's
    // description lookup (see complete.ts's own doc comment) never surface as their own,
    // nonexistent candidates — the real CLI has no --color/--animation/--suppressions flags.
    for (const phantom of ['--color', '--animation', '--suppressions']) {
      expect(lines.some((l) => l.startsWith(`${phantom}\t`))).toBe(false);
    }
  });
});

describe('runCli dispatch: `complete` is a new reserved top-level token, wired unsliced', () => {
  it('routes through runCli with the full argv (complete included), exiting naturally', async () => {
    const log = spyLog();
    const io = captureIO();
    const result = await runCli(['complete', 'zsh'], io);
    expect(result).toEqual({ code: 0, exit: 'natural' });
    expect(log.calls().length).toBeGreaterThan(100);
  });

  it('a directory literally named `complete` is shadowed, same as docs/explain/install/ci (declared, not a regression)', async () => {
    const io = captureIO();
    const result = await runCli(['complete', 'nonexistent-shell-name'], io);
    expect(result.code).toBe(2);
    expect(io.err).toContain("unknown shell 'nonexistent-shell-name'");
  });
});

describe('ja `--help` design: SVELTE_VITALS_LANG=ja never reaches the completion tree', () => {
  /** Mutates real `process.env` (not `runCli`'s injected env param, which `complete` never even
   * receives — see `cli.ts`'s own doc comment): the completion tree is built from the raw en
   * declarations regardless, and this proves that holds even against genuine ambient env, not
   * merely against an unrelated parameter no code path reads. */
  async function underJaEnv<T>(fn: () => Promise<T>): Promise<T> {
    const prior = process.env.SVELTE_VITALS_LANG;
    process.env.SVELTE_VITALS_LANG = 'ja';
    try {
      return await fn();
    } finally {
      if (prior === undefined) delete process.env.SVELTE_VITALS_LANG;
      else process.env.SVELTE_VITALS_LANG = prior;
    }
  }

  for (const shell of SHELLS) {
    it(`${shell}: emitted script is byte-identical under a real ja env`, async () => {
      const baseline = spyLog();
      await runCompleteCliGunshi(['complete', shell], captureIO());
      const en = baseline.calls();
      baseline.restore();

      const under = spyLog();
      await underJaEnv(() => runCompleteCliGunshi(['complete', shell], captureIO()));
      const ja = under.calls();
      under.restore();

      expect(ja).toBe(en);
    });
  }

  it('flag/value candidate descriptions are unchanged under a real ja env', async () => {
    async function candidateLines(words: string[]): Promise<string> {
      const log = spyLog();
      await runCompleteCliGunshi(['complete', '--', ...words], captureIO());
      const out = log.calls();
      log.restore();
      return out;
    }

    const en = await candidateLines(['--']);
    const ja = await underJaEnv(() => candidateLines(['--']));
    expect(ja).toBe(en);
  });
});

describe('spawn the built dist (skipped if `pnpm build` has not run)', () => {
  const cliBin = join(import.meta.dirname, '..', 'dist', 'bin.js');
  const has = existsSync(cliBin);

  function run(args: string[]) {
    try {
      const stdout = execFileSync(process.execPath, [cliBin, ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      });
      return { code: 0, stdout, stderr: '' };
    } catch (err) {
      const e = err as { status: number; stdout?: string; stderr?: string };
      return { code: e.status, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') };
    }
  }

  it.skipIf(!has)('complete zsh exits 0 with a non-empty script through the packaged binary', () => {
    const { code, stdout } = run(['complete', 'zsh']);
    expect(code).toBe(0);
    expect(stdout.length).toBeGreaterThan(100);
    expect(stdout).toContain('svelte-vitals');
  });

  it.skipIf(!has)('complete -- resolves sub-command names through the packaged binary', () => {
    const { code, stdout } = run(['complete', '--', '']);
    expect(code).toBe(0);
    expect(stdout).toContain('docs\t');
    expect(stdout).toContain('explain\t');
    expect(stdout).toContain('install\t');
    expect(stdout).toContain('ci\t');
  });

  it.skipIf(!has)('an unsupported shell exits 2 with stdout empty through the packaged binary', () => {
    const { code, stdout, stderr } = run(['complete', 'tcsh']);
    expect(code).toBe(2);
    expect(stdout).toBe('');
    expect(stderr).toContain("unknown shell 'tcsh'");
  });
});

describe('locale isolation through the real runCli dispatch (explicit env, no process.env mutation)', () => {
  // Complements the ambient-env cells above: these go through `runCli` itself with injected
  // envs, so a future `runCli` change that threads locale into the completion path fails here
  // even if the ambient mechanism stays inert.
  async function viaRunCli(args: string[], env: NodeJS.ProcessEnv): Promise<string> {
    const { runCli } = await import('../src/cli.js');
    const log = spyLog();
    await runCli(args, captureIO(), env);
    const out = log.calls();
    log.restore();
    return out;
  }

  for (const shell of SHELLS) {
    it(`${shell}: script byte-identical between explicit clean and ja envs`, async () => {
      const en = await viaRunCli(['complete', shell], {});
      const ja = await viaRunCli(['complete', shell], { SVELTE_VITALS_LANG: 'ja' });
      expect(ja).toBe(en);
    });
  }

  it('candidate descriptions byte-identical between explicit clean and ja envs', async () => {
    const en = await viaRunCli(['complete', '--', '--'], {});
    const ja = await viaRunCli(['complete', '--', '--'], { SVELTE_VITALS_LANG: 'ja' });
    expect(ja).toBe(en);
  });
});
