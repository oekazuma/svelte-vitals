import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { run } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures', 'basic-project');

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    log: (line: string) => out.push(line),
    errorLog: (line: string) => err.push(line)
  };
}

describe('run() end-to-end', () => {
  it('returns exit 1 and reports the missing title', async () => {
    const cap = capture();
    const code = await run({ cwd: fixtureDir, log: cap.log, errorLog: cap.errorLog });
    expect(code).toBe(1);

    const report = cap.out.join('\n');
    expect(report).toContain('Critical (2)');
    expect(report).toContain('✗ SEO001  Missing <title>');
    expect(report).toContain('/none');
    expect(report).toContain('↯ dynamic'); // /dynamic passes with marker
  });

  it('returns exit 2 for a non-SvelteKit directory', async () => {
    const cap = capture();
    const code = await run({ cwd: here, log: cap.log, errorLog: cap.errorLog });
    expect(code).toBe(2);
    expect(cap.err.join('\n')).toContain('No SvelteKit project found');
  });
});

describe('run() flags', () => {
  it('suppresses a missing title for a metaComponents-declared component', async () => {
    const cap = capture();
    const code = await run({ cwd: fixtureDir, log: cap.log, errorLog: cap.errorLog, metaComponents: ['Widget'] });
    const failures = cap.out.join('\n').split('Passed')[0];
    expect(failures).not.toContain('/widget');
    expect(code).toBe(1); // /none is still a missing-title critical
  });

  it('limits analysis to a route glob', async () => {
    const cap = capture();
    const code = await run({ cwd: fixtureDir, log: cap.log, errorLog: cap.errorLog, route: 'static/**' });
    expect(code).toBe(0); // only /static analyzed, which passes
    expect(cap.out.join('\n')).not.toContain('/none');
  });
});
