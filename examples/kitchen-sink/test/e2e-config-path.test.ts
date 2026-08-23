import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// The gallery ships its own svelte-vitals.config.ts, so a --config run that changes the result
// proves both halves at once: the named file is loaded, and discovery is skipped rather than
// merged. Guard (1) of the two-guard rule for user-facing levers (AGENTS.md).
const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const bin = join(appDir, '..', '..', 'packages', 'cli', 'dist', 'bin.js');

interface JsonReport {
  rules: Record<string, { findings: number; passed: number }>;
}

function run(...args: string[]): JsonReport {
  const res = spawnSync(process.execPath, [bin, appDir, ...args, '--reporter', 'json'], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });
  return JSON.parse(res.stdout) as JsonReport;
}

let scratch: string;

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), 'sv-config-path-'));
  writeFileSync(
    join(scratch, 'svelte-vitals.config.js'),
    "export default { rules: { 'seo/title-presence': 'off' } };\n"
  );
});

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe('--config <path>', () => {
  it('analyzes under the named config instead of the project’s own', () => {
    const discovered = run();
    expect(discovered.rules['seo/title-presence']!.findings).toBeGreaterThan(0);

    const named = run('--config', join(scratch, 'svelte-vitals.config.js'));
    expect(named.rules['seo/title-presence']).toBeUndefined();
  });

  it('exits 2 when the named config does not exist', () => {
    const res = spawnSync(process.execPath, [bin, appDir, '--config', join(scratch, 'absent.config.js')], {
      encoding: 'utf8'
    });
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/does not exist/);
  });
});
