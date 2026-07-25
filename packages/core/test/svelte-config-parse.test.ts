import { describe, it, expect } from 'vitest';
import {
  findKitPathsBaseInSvelteConfig,
  findKitPathsBaseInViteConfig,
  resolveKitPathsBase
} from '../src/svelte-config-parse.js';

describe('findKitPathsBaseInSvelteConfig', () => {
  it('reads a literal base from an exported object', () => {
    const src = `export default { kit: { paths: { base: '/docs' } } };`;
    expect(findKitPathsBaseInSvelteConfig(src)).toEqual({ value: '/docs' });
  });

  it('reads a literal base through a same-file alias', () => {
    const src = [`const config = { kit: { paths: { base: '/docs' } } };`, `export default config;`].join('\n');
    expect(findKitPathsBaseInSvelteConfig(src)).toEqual({ value: '/docs' });
  });

  it('reports a dynamic base as present-but-unknown', () => {
    const src = [
      `import { dev } from '$app/environment';`,
      `export default { kit: { paths: { base: dev ? '' : '/repo' } } };`
    ].join('\n');
    expect(findKitPathsBaseInSvelteConfig(src)).toEqual({});
  });

  it('ignores an empty-string base', () => {
    expect(findKitPathsBaseInSvelteConfig(`export default { kit: { paths: { base: '' } } };`)).toBeUndefined();
  });

  it('ignores a config with no paths.base', () => {
    expect(findKitPathsBaseInSvelteConfig(`export default { kit: { adapter: adapter() } };`)).toBeUndefined();
  });

  it('returns undefined for a malformed source instead of throwing', () => {
    expect(findKitPathsBaseInSvelteConfig(`export default { kit: {`)).toBeUndefined();
  });
});

describe('findKitPathsBaseInViteConfig', () => {
  const vite = (plugins: string, imports = `import { sveltekit } from '@sveltejs/kit/vite';`) =>
    [imports, `export default { plugins: [${plugins}] };`].join('\n');

  it('reads a literal base from the sveltekit() plugin config', () => {
    expect(findKitPathsBaseInViteConfig(vite(`sveltekit({ paths: { base: '/docs' } })`))).toEqual({
      kind: 'resolved',
      base: { value: '/docs' }
    });
  });

  it('reports a dynamic base in the plugin config as present-but-unknown', () => {
    expect(findKitPathsBaseInViteConfig(vite(`sveltekit({ paths: { base: process.env.BASE ?? '' } })`))).toEqual({
      kind: 'resolved',
      base: {}
    });
  });

  it('resolves a plugin config with no paths.base to resolved-without-base', () => {
    expect(findKitPathsBaseInViteConfig(vite(`sveltekit({ adapter: adapter() })`))).toEqual({ kind: 'resolved' });
  });

  it('treats an argument-less sveltekit() as no plugin config', () => {
    expect(findKitPathsBaseInViteConfig(vite(`sveltekit()`))).toEqual({ kind: 'no-plugin-config' });
  });

  it('treats an unresolvable plugin argument as unresolvable', () => {
    const src = [
      `import { sveltekit } from '@sveltejs/kit/vite';`,
      `import kitConfig from './kit.config.js';`,
      `export default { plugins: [sveltekit(kitConfig)] };`
    ].join('\n');
    expect(findKitPathsBaseInViteConfig(src)).toEqual({ kind: 'unresolvable' });
  });

  it('resolves the plugin config through defineConfig and a same-file alias', () => {
    const src = [
      `import { sveltekit } from '@sveltejs/kit/vite';`,
      `import { defineConfig } from 'vite';`,
      `const kit = { paths: { base: '/docs' } };`,
      `export default defineConfig({ plugins: [sveltekit(kit)] });`
    ].join('\n');
    expect(findKitPathsBaseInViteConfig(src)).toEqual({ kind: 'resolved', base: { value: '/docs' } });
  });

  it('honours an aliased sveltekit import', () => {
    const src = vite(`kit({ paths: { base: '/docs' } })`, `import { sveltekit as kit } from '@sveltejs/kit/vite';`);
    expect(findKitPathsBaseInViteConfig(src)).toEqual({ kind: 'resolved', base: { value: '/docs' } });
  });

  it('reports no plugin config when the plugins array has no sveltekit call', () => {
    expect(findKitPathsBaseInViteConfig(vite(`svelte()`, `import { svelte } from 'x';`))).toEqual({
      kind: 'no-plugin-config'
    });
  });

  it('reports no plugin config for a config with no plugins array', () => {
    expect(findKitPathsBaseInViteConfig(`export default { build: { minify: false } };`)).toEqual({
      kind: 'no-plugin-config'
    });
  });

  it('returns no-plugin-config for a malformed source instead of throwing', () => {
    expect(findKitPathsBaseInViteConfig(`export default { plugins: [`)).toEqual({ kind: 'no-plugin-config' });
  });
});

describe('resolveKitPathsBase', () => {
  const svelteConfig = { file: 'svelte.config.js', source: `export default { kit: { paths: { base: '/s' } } };` };
  const viteWith = (plugins: string) => ({
    file: 'vite.config.ts',
    source: [`import { sveltekit } from '@sveltejs/kit/vite';`, `export default { plugins: [${plugins}] };`].join('\n')
  });

  it('prefers the plugin config over svelte.config', () => {
    expect(resolveKitPathsBase(viteWith(`sveltekit({ paths: { base: '/v' } })`), svelteConfig)).toEqual({
      value: '/v',
      file: 'vite.config.ts'
    });
  });

  it('does not fall back to svelte.config when the plugin config resolves without a base', () => {
    expect(resolveKitPathsBase(viteWith(`sveltekit({ adapter: adapter() })`), svelteConfig)).toBeUndefined();
  });

  it('does not fall back to svelte.config when the plugin argument is unresolvable', () => {
    const src = [
      `import { sveltekit } from '@sveltejs/kit/vite';`,
      `import kitConfig from './kit.config.js';`,
      `export default { plugins: [sveltekit(kitConfig)] };`
    ].join('\n');
    expect(resolveKitPathsBase({ file: 'vite.config.ts', source: src }, svelteConfig)).toBeUndefined();
  });

  it('falls back to svelte.config for an argument-less sveltekit()', () => {
    expect(resolveKitPathsBase(viteWith(`sveltekit()`), svelteConfig)).toEqual({
      value: '/s',
      file: 'svelte.config.js'
    });
  });

  it('reads svelte.config when there is no vite config', () => {
    expect(resolveKitPathsBase(undefined, svelteConfig)).toEqual({ value: '/s', file: 'svelte.config.js' });
  });

  it('carries a dynamic base through with only the file', () => {
    const dynamic = {
      file: 'svelte.config.js',
      source: `export default { kit: { paths: { base: process.env.BASE ?? '' } } };`
    };
    expect(resolveKitPathsBase(undefined, dynamic)).toEqual({ file: 'svelte.config.js' });
  });

  it('returns undefined when neither config exists', () => {
    expect(resolveKitPathsBase(undefined, undefined)).toBeUndefined();
  });
});
