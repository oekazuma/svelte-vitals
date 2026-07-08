import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { run } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const monorepoFixture = join(here, 'fixtures', 'monorepo-project');
const CLEAN_ENV: NodeJS.ProcessEnv = {};

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, log: (l: string) => out.push(l), errorLog: (l: string) => err.push(l) };
}

describe('run(): monorepo app discovery + picker (design doc 2026-07-08-monorepo-app-picker-design.md)', () => {
  it('TTY + multiple apps: selectApp is offered and the chosen app is analyzed', async () => {
    const cap = capture();
    const selectApp = vi.fn(async (apps: string[]) => apps[apps.indexOf('apps/web')] ?? apps[0]!);
    const code = await run({
      cwd: monorepoFixture,
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV,
      stdinIsTTY: true,
      stdoutIsTTY: true,
      selectApp
    });
    expect(selectApp).toHaveBeenCalledWith(['apps/admin', 'apps/web']);
    expect(code).toBe(1); // both fixture apps are missing a <title> -> SEO001 critical
    expect(cap.out.join('\n')).toContain('SEO001');
  });

  it('TTY + multiple apps + cancel (selectApp returns null): exit 0, "Cancelled."', async () => {
    const cap = capture();
    const selectApp = vi.fn(async () => null);
    const code = await run({
      cwd: monorepoFixture,
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV,
      stdinIsTTY: true,
      stdoutIsTTY: true,
      selectApp
    });
    expect(code).toBe(0);
    expect(cap.out.join('\n')).toContain('Cancelled.');
  });

  it('non-TTY + multiple apps: exit 2 with the app list and a path hint; selectApp is never called', async () => {
    const cap = capture();
    const selectApp = vi.fn(async () => 'apps/web');
    const code = await run({
      cwd: monorepoFixture,
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV,
      stdoutIsTTY: false,
      selectApp
    });
    expect(code).toBe(2);
    expect(selectApp).not.toHaveBeenCalled();
    const errOutput = cap.err.join('\n');
    expect(errOutput).toContain('multiple SvelteKit apps found: apps/admin, apps/web');
    expect(errOutput).toContain('npx svelte-vitals apps/admin');
  });

  it('piped stdin (stdin not a TTY, stdout a TTY): non-TTY fallback — exit 2 with the list, no prompt', async () => {
    // clack reads from stdin; prompting with a piped/redirected stdin would hang forever.
    const cap = capture();
    const selectApp = vi.fn(async () => 'apps/web');
    const code = await run({
      cwd: monorepoFixture,
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV,
      stdinIsTTY: false,
      stdoutIsTTY: true,
      selectApp
    });
    expect(code).toBe(2);
    expect(selectApp).not.toHaveBeenCalled();
    expect(cap.err.join('\n')).toContain('multiple SvelteKit apps found: apps/admin, apps/web');
  });

  it('explicitPath:true + non-SvelteKit cwd: immediate exit 2, no discovery, selectApp never called', async () => {
    const cap = capture();
    const selectApp = vi.fn(async () => 'apps/web');
    const code = await run({
      cwd: monorepoFixture, // has discoverable apps, but explicitPath must suppress discovery
      explicitPath: true,
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV,
      stdoutIsTTY: true,
      selectApp
    });
    expect(code).toBe(2);
    expect(selectApp).not.toHaveBeenCalled();
    expect(cap.err.join('\n')).toContain('No SvelteKit project found');
  });

  it('zero apps found: falls back to the original (reworded) error, exit 2', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'sv-discover-none-'));
    try {
      const cap = capture();
      const code = await run({ cwd, log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV, stdoutIsTTY: true });
      expect(code).toBe(2);
      expect(cap.err.join('\n')).toContain(
        'No SvelteKit project found in the current directory. Run this inside a SvelteKit app, or pass a path (e.g. npx svelte-vitals apps/web).'
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

describe('run(): monorepo discovery, exactly one app found', () => {
  let cwd: string;
  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'sv-discover-one-'));
    await mkdir(join(cwd, 'apps/web/src/routes'), { recursive: true });
    await writeFile(join(cwd, 'apps/web/svelte.config.js'), 'export default {};\n');
    await writeFile(
      join(cwd, 'apps/web/src/routes/+page.svelte'),
      '<svelte:head>\n  <meta property="og:type" content="website" />\n</svelte:head>\n\n<h1>No title</h1>\n'
    );
  });
  afterEach(async () => rm(cwd, { recursive: true, force: true }));

  it('auto-continues with a stderr notice and analyzes the sole app', async () => {
    const cap = capture();
    const selectApp = vi.fn(async () => 'apps/web'); // must not be called for a single match
    const code = await run({ cwd, log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV, stdoutIsTTY: true, selectApp });
    expect(selectApp).not.toHaveBeenCalled();
    expect(cap.err.join('\n')).toContain('detected SvelteKit app at apps/web; analyzing it.');
    expect(code).toBe(1);
    expect(cap.out.join('\n')).toContain('SEO001');
  });
});
