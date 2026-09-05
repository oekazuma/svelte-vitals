import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const THROWN = 'synthetic rule failure (test)\nsecond line must not be printed';

vi.mock('@svelte-vitals/core/internal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@svelte-vitals/core/internal')>();
  const allRules = actual.allRules.map((rule) =>
    rule.id === 'seo/title-presence'
      ? {
          ...rule,
          check: async () => {
            throw new Error(THROWN);
          }
        }
      : rule
  );
  return { ...actual, allRules };
});

const { analyze } = await import('../src/analyze.js');

describe('vite build path reports a crashed rule', () => {
  let cwd: string;
  let pages: string;
  beforeAll(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'sv-rule-failure-'));
    pages = join(cwd, '.svelte-kit/output/prerendered/pages');
    await mkdir(pages, { recursive: true });
    await writeFile(join(pages, 'index.html'), '<html lang="en"><head><title>Home</title></head><body></body></html>');
  });
  afterAll(async () => rm(cwd, { recursive: true, force: true }));

  it('names the rule and only the first line of its message in warnings', async () => {
    const r = await analyze(pages, cwd, { report: false });
    expect(r.warnings).toContain('rule seo/title-presence failed and was skipped: synthetic rule failure (test)');
    expect(r.warnings.some((w) => w.includes('second line'))).toBe(false);
  });
});
