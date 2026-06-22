import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyze } from '../src/analyze.js';

describe('analyze', () => {
  let cwd: string;
  let pages: string;
  beforeAll(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'sv-analyze-'));
    pages = join(cwd, '.svelte-kit/output/prerendered/pages');
    await mkdir(pages, { recursive: true });
    // one good page, one missing title
    await writeFile(
      join(pages, 'index.html'),
      `<html lang="en"><head><title>Home</title><meta name="description" content="d"/></head><body></body></html>`
    );
    await writeFile(
      join(pages, 'bad.html'),
      `<html lang="en"><head><meta charset="utf-8"/></head><body></body></html>`
    );
  });
  afterAll(async () => rm(cwd, { recursive: true, force: true }));

  it('runs all rules over rendered routes and computes a score', async () => {
    const r = await analyze(pages, cwd, { report: false });
    expect(r.routeCount).toBe(2);
    // /bad is missing <title> (critical) -> headline capped at 79
    expect(r.score).toBeLessThanOrEqual(79);
    expect(r.results.some((x) => x.id === 'SEO001' && x.route === '/bad' && x.detection.presence === 'none')).toBe(
      true
    );
    // html lang present (en) -> SEO009 not a site issue
    const json = JSON.parse(r.jsonReport);
    expect(json.siteIssues.map((i: { id: string }) => i.id)).not.toContain('SEO009');
    // console report must carry the plugin-mode label and not the static-mode label
    expect(r.consoleReport).toContain('Svelte Vitals  (rendered / plugin)');
    expect(r.consoleReport).not.toContain('static mode');
  });

  it('fails when findings meet failOn', async () => {
    const r = await analyze(pages, cwd, { report: false, failOn: 'critical' });
    expect(r.failed).toBe(true);
  });
});
