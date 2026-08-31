import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { discoverApps } from '../src/discover-apps.js';

const here = dirname(fileURLToPath(import.meta.url));
const monorepoFixture = join(here, 'fixtures', 'monorepo-project');

describe('discoverApps', () => {
  it('returns sorted app dirs with svelte.config.{js,ts} + src/routes', async () => {
    expect(await discoverApps(monorepoFixture)).toEqual(['apps/admin', 'apps/mobile', 'apps/web']);
  });

  it('also finds an app with no svelte.config.{js,ts}, detected via @sveltejs/kit in package.json', async () => {
    // current `sv create` output folds SvelteKit config into vite.config.ts and emits no
    // separate svelte.config file — discoverApps must not depend on that file existing.
    const apps = await discoverApps(monorepoFixture);
    expect(apps).toContain('apps/mobile');
  });

  it('excludes a component library (svelte.config without src/routes)', async () => {
    const apps = await discoverApps(monorepoFixture);
    expect(apps).not.toContain('packages/ui');
  });

  it('excludes a package with @sveltejs/kit in package.json but no src/routes', async () => {
    const apps = await discoverApps(monorepoFixture);
    expect(apps).not.toContain('packages/shared-lib');
  });

  it('returns [] in a directory tree with no SvelteKit apps', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'sv-discover-empty-'));
    try {
      expect(await discoverApps(cwd)).toEqual([]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('finds apps up to 4 path segments deep and stops there (design doc depth cap)', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'sv-discover-depth-'));
    const plant = async (dir: string) => {
      await mkdir(join(cwd, dir, 'src/routes'), { recursive: true });
      await writeFile(join(cwd, dir, 'svelte.config.js'), 'export default {};\n');
    };
    try {
      await plant('a/b/c'); // config at 4 segments — inside the cap
      await plant('a/b/c/d'); // config at 5 segments — beyond it
      expect(await discoverApps(cwd)).toEqual(['a/b/c']);
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
