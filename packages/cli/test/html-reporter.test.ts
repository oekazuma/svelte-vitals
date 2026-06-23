import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { run } from '../src/index.js';
import { isReporterName } from '../src/reporter-resolve.js';

const fixture = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'basic-project'); // the SvelteKit fixture the other CLI tests use

describe('html reporter', () => {
  it('accepts "html" as a reporter name', () => {
    expect(isReporterName('html')).toBe(true);
  });

  it('writes a default file and prints the path to stderr', async () => {
    const writes: Array<[string, string]> = [];
    const errs: string[] = [];
    const code = await run({
      cwd: fixture,
      reporter: 'html',
      env: {},
      writeFile: (p, c) => writes.push([p, c]),
      log: () => {},
      errorLog: (l) => errs.push(l)
    });
    expect(code).toBeTypeOf('number');
    expect(writes).toHaveLength(1);
    expect(writes[0]![0]).toBe('svelte-vitals-report.html');
    expect(writes[0]![1].startsWith('<!doctype html>')).toBe(true);
    expect(errs.some((e) => e.includes('wrote report to svelte-vitals-report.html'))).toBe(true);
  });

  it('honors --out-file path', async () => {
    const writes: Array<[string, string]> = [];
    await run({
      cwd: fixture,
      reporter: 'html',
      outFile: 'out/report.html',
      env: {},
      writeFile: (p, c) => writes.push([p, c]),
      log: () => {},
      errorLog: () => {}
    });
    expect(writes[0]![0]).toBe('out/report.html');
  });

  it('writes to stdout (not the filesystem) when out-file is "-"', async () => {
    const writes: string[] = [];
    const logs: string[] = [];
    await run({
      cwd: fixture,
      reporter: 'html',
      outFile: '-',
      env: {},
      writeFile: () => writes.push('FS'),
      log: (l) => logs.push(l),
      errorLog: () => {}
    });
    expect(writes).toHaveLength(0);
    expect(logs.join('\n')).toContain('<!doctype html>');
  });

  it('falls back to the default path when out-file is an empty string', async () => {
    const writes: Array<[string, string]> = [];
    await run({
      cwd: fixture,
      reporter: 'html',
      outFile: '',
      env: {},
      writeFile: (p, c) => writes.push([p, c]),
      log: () => {},
      errorLog: () => {}
    });
    expect(writes[0]![0]).toBe('svelte-vitals-report.html');
  });

  it('creates missing parent directories for --out-file (default writer)', async () => {
    const base = mkdtempSync(join(tmpdir(), 'sv-html-'));
    const out = join(base, 'nested', 'deep', 'report.html');
    try {
      const code = await run({
        cwd: fixture,
        reporter: 'html',
        outFile: out,
        env: {},
        log: () => {},
        errorLog: () => {}
      });
      expect(code).toBeTypeOf('number');
      expect(existsSync(out)).toBe(true);
      expect(readFileSync(out, 'utf8').startsWith('<!doctype html>')).toBe(true);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
