import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectProjectFacts } from '../src/providers/source/project.js';
import { createNodeRuntime } from '../src/runtime/node.js';

async function project(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'svelte-vitals-base-'));
  await mkdir(join(dir, 'src'), { recursive: true });
  for (const [name, content] of Object.entries(files)) await writeFile(join(dir, name), content, 'utf8');
  return dir;
}

const svelteConfig = (base: string) => `export default { kit: { paths: { base: ${base} } } };`;
const viteConfig = (plugins: string) =>
  [`import { sveltekit } from '@sveltejs/kit/vite';`, `export default { plugins: [${plugins}] };`].join('\n');

describe('collectProjectFacts: kitPathsBase', () => {
  it('reads a literal base from svelte.config.js', async () => {
    const dir = await project({ 'svelte.config.js': svelteConfig(`'/docs'`) });
    expect((await collectProjectFacts(createNodeRuntime(), dir)).kitPathsBase).toEqual({
      value: '/docs',
      file: 'svelte.config.js'
    });
  });

  it('omits the fact when no config declares a base', async () => {
    const dir = await project({ 'svelte.config.js': `export default { kit: {} };` });
    expect((await collectProjectFacts(createNodeRuntime(), dir)).kitPathsBase).toBeUndefined();
  });

  it('omits the fact for an explicit empty base', async () => {
    const dir = await project({ 'svelte.config.js': svelteConfig(`''`) });
    expect((await collectProjectFacts(createNodeRuntime(), dir)).kitPathsBase).toBeUndefined();
  });

  it('keeps the fact without a value for a dynamic base', async () => {
    const dir = await project({ 'svelte.config.js': svelteConfig(`process.env.BASE ?? ''`) });
    expect((await collectProjectFacts(createNodeRuntime(), dir)).kitPathsBase).toEqual({ file: 'svelte.config.js' });
  });

  it('prefers the sveltekit() plugin config over svelte.config', async () => {
    const dir = await project({
      'svelte.config.js': svelteConfig(`'/from-svelte-config'`),
      'vite.config.ts': viteConfig(`sveltekit({ paths: { base: '/from-vite' } })`)
    });
    expect((await collectProjectFacts(createNodeRuntime(), dir)).kitPathsBase).toEqual({
      value: '/from-vite',
      file: 'vite.config.ts'
    });
  });

  it('falls back to svelte.config for an argument-less sveltekit()', async () => {
    const dir = await project({
      'svelte.config.js': svelteConfig(`'/docs'`),
      'vite.config.ts': viteConfig(`sveltekit()`)
    });
    expect((await collectProjectFacts(createNodeRuntime(), dir)).kitPathsBase).toEqual({
      value: '/docs',
      file: 'svelte.config.js'
    });
  });

  it('omits the fact when there is no config at all', async () => {
    const dir = await project({});
    expect((await collectProjectFacts(createNodeRuntime(), dir)).kitPathsBase).toBeUndefined();
  });
});
