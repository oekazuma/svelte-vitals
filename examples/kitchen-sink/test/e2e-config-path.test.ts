import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// architecture/directory-naming is inert until a config sets its `directories` option — the
// gallery's own svelte-vitals.config.ts is the only thing that wakes it, at the gallery's own
// baseline finding. Any --config run that reports zero for it, while a bare run reports the
// baseline, proves the named file replaced the discovered config rather than merging with it:
// a merge would keep the discovered `directories` option active and the finding would persist.
// seo/title-presence disagrees the other way (the scratch config turns it off, the discovered
// one leaves it on), pinning that the named file is loaded at all. Guard (1) of the two-guard
// rule for user-facing levers (AGENTS.md).
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
    expect(discovered.rules['architecture/directory-naming']!.findings).toBeGreaterThan(0);

    const named = run('--config', join(scratch, 'svelte-vitals.config.js'));
    expect(named.rules['seo/title-presence']).toBeUndefined();
    expect(named.rules['architecture/directory-naming']?.findings ?? 0).toBe(0);
  });

  it('exits 2 when the named config does not exist', () => {
    const res = spawnSync(process.execPath, [bin, appDir, '--config', join(scratch, 'absent.config.js')], {
      encoding: 'utf8'
    });
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/does not exist/);
  });
});
