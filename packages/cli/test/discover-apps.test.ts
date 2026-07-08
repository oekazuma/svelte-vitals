import { describe, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { discoverApps } from '../src/discover-apps.js';

const here = dirname(fileURLToPath(import.meta.url));
const monorepoFixture = join(here, 'fixtures', 'monorepo-project');

describe('discoverApps', () => {
  it('returns sorted app dirs with svelte.config.{js,ts} + src/routes', async () => {
    expect(await discoverApps(monorepoFixture)).toEqual(['apps/admin', 'apps/web']);
  });

  it('excludes a component library (svelte.config without src/routes)', async () => {
    const apps = await discoverApps(monorepoFixture);
    expect(apps).not.toContain('packages/ui');
  });

  it('returns [] in a directory tree with no SvelteKit apps', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'sv-discover-empty-'));
    try {
      expect(await discoverApps(cwd)).toEqual([]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('does not include cwd itself even if it has a qualifying svelte.config', async () => {
    // basic-project qualifies via package.json's @sveltejs/kit dep, not svelte.config, so
    // exercise the exclusion directly against a fixture with a root-level svelte.config.
    const rootFixture = join(here, 'fixtures', 'monorepo-project', 'apps', 'web');
    const apps = await discoverApps(rootFixture);
    expect(apps).not.toContain('.');
    expect(apps).toEqual([]);
  });
});
