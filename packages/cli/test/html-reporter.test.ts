import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
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
});
