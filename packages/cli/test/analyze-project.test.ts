import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { analyzeProject } from '../src/index.js';
import { ProjectError } from '../src/providers/source/project.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures', 'basic-project');

describe('analyzeProject', () => {
  it('returns results, config and version for a SvelteKit project', async () => {
    const { results, config, version } = await analyzeProject({ cwd: fixtureDir });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.id === 'SEO001')).toBe(true);
    expect(config.treatDynamicAs).toBe('pass');
    expect(typeof version).toBe('string');
  });

  it('respects the route glob filter', async () => {
    const { results } = await analyzeProject({ cwd: fixtureDir, route: 'none' });
    const routes = new Set(results.filter((r) => r.route).map((r) => r.route));
    expect(routes.size).toBeGreaterThan(0);
    for (const route of routes) expect(route).toBe('/none');
  });

  it('throws ProjectError for a non-SvelteKit directory', async () => {
    await expect(analyzeProject({ cwd: here })).rejects.toBeInstanceOf(ProjectError);
  });
});
