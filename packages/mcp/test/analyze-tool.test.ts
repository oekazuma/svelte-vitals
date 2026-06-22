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
    // The text payload and the structured payload must be the same report — guard
    // against drift between the two shapes (summary, finding metadata, scores).
    expect(JSON.parse(res.content[0]!.text)).toEqual(report);
  });

  it('honors metaComponents so a wrapper-supplied title is not flagged', async () => {
    type Report = { routes: Array<{ route: string; issues: Array<{ id: string }> }> };
    const widgetIssues = (report: Report) =>
      report.routes.find((r) => r.route === '/widget')?.issues.map((i) => i.id) ?? [];

    // Baseline: /widget renders <Widget /> with no <title>, so SEO001 fires there.
    const base = await handleAnalyze({ path: fixtureDir });
    expect(widgetIssues(base.structuredContent as Report)).toContain('SEO001');

    // Declaring Widget as a meta component promotes its title to dynamic/pass.
    const withMeta = await handleAnalyze({ path: fixtureDir, metaComponents: ['Widget'] });
    expect(withMeta.isError).toBeFalsy();
    expect(widgetIssues(withMeta.structuredContent as Report)).not.toContain('SEO001');
  });

  it('accepts rule ids case-insensitively', async () => {
    const res = await handleAnalyze({ path: fixtureDir, rules: ['seo001'] });
    expect(res.isError).toBeFalsy();
    const report = res.structuredContent as { routes: Array<{ issues: Array<{ id: string }> }> };
    const ids = new Set(report.routes.flatMap((r) => r.issues.map((i) => i.id)));
    // Allow-list of a single rule disables the others, so only SEO001 can appear.
    // Guard against a vacuous pass: the fixture must surface at least one SEO001.
    expect(ids.size).toBeGreaterThan(0);
    for (const id of ids) expect(id).toBe('SEO001');
  });

  it('reports an error for an unknown rule id', async () => {
    const res = await handleAnalyze({ path: fixtureDir, rules: ['NOPE999'] });
    expect(res.isError).toBe(true);
    const text = res.content[0]!.text;
    expect(text).toContain('Unknown rule id(s): NOPE999');
    expect(text).toContain('Known rule ids:');
    expect(text).toContain('SEO001');
  });

  it('reports an error for a non-SvelteKit path', async () => {
    const res = await handleAnalyze({ path: here });
    expect(res.isError).toBe(true);
    // Propagates the CLI's ProjectError message verbatim.
    expect(res.content[0]!.text).toContain('No SvelteKit project found');
  });
});
