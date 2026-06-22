import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { handleAnalyze } from '../src/tools/analyze.js';

const here = dirname(fileURLToPath(import.meta.url));
// Reuse the CLI's fixture project so we don't duplicate a SvelteKit tree.
const fixtureDir = join(here, '..', '..', 'cli', 'test', 'fixtures', 'basic-project');

describe('analyze tool', () => {
  it('returns a structured JSON report for a project path', async () => {
    const res = await handleAnalyze({ path: fixtureDir });
    expect(res.isError).toBeFalsy();
    const report = res.structuredContent as { score: number; routes: unknown[]; summary: unknown };
    expect(typeof report.score).toBe('number');
    expect(Array.isArray(report.routes)).toBe(true);
    expect(res.content[0]!.text).toContain('score');
  });

  it('reports an error for an unknown rule id', async () => {
    const res = await handleAnalyze({ path: fixtureDir, rules: ['NOPE999'] });
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain('NOPE999');
  });

  it('reports an error for a non-SvelteKit path', async () => {
    const res = await handleAnalyze({ path: here });
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain('SvelteKit');
  });
});
