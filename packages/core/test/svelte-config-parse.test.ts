import { describe, it, expect } from 'vitest';
import {
  findKitPathsBaseInSvelteConfig,
  findKitPathsBaseInViteConfig,
  resolveKitPathsBase,
  findKitAliasesInSvelteConfig,
  resolveKitAliases
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

  it('ignores an empty-string base in the plugin config', () => {
    expect(findKitPathsBaseInViteConfig(vite(`sveltekit({ paths: { base: '' } })`))).toEqual({ kind: 'resolved' });
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

describe('findKitAliasesInSvelteConfig', () => {
  const raw = (body: string) => findKitAliasesInSvelteConfig(`export default { kit: ${body} };`);

  it('reads alias entries in declaration order', () => {
    expect(raw(`{ alias: { '$b': 'src/b', '$a': 'src/a' } }`).entries).toEqual([
      { key: '$b', value: 'src/b' },
      { key: '$a', value: 'src/a' }
    ]);
  });

  it('records a non-literal value as null while its literal siblings keep theirs', () => {
    const src = [
      `import path from 'node:path';`,
      `export default { kit: { alias: { '$a': path.resolve('x'), '$b': 'src/b' } } };`
    ].join('\n');
    expect(findKitAliasesInSvelteConfig(src).entries).toEqual([
      { key: '$a', value: null },
      { key: '$b', value: 'src/b' }
    ]);
  });

  it('keeps a duplicate key at its first position with its last value', () => {
    // Object.entries semantics: { a: 1, b: 2, a: 3 } yields a at index 0 with value 3.
    expect(raw(`{ alias: { '$a': 'src/one', '$b': 'src/two', '$a': 'src/three' } }`).entries).toEqual([
      { key: '$a', value: 'src/three' },
      { key: '$b', value: 'src/two' }
    ]);
  });

  it('discards every entry when a spread makes the key set unknowable', () => {
    const src = [`const shared = {};`, `export default { kit: { alias: { ...shared, '$a': 'src/a' } } };`].join('\n');
    expect(findKitAliasesInSvelteConfig(src).entries).toBeUndefined();
  });

  it('discards every entry when a key is computed', () => {
    const src = [`const KEY = '$a';`, `export default { kit: { alias: { [KEY]: 'src/a' } } };`].join('\n');
    expect(findKitAliasesInSvelteConfig(src).entries).toBeUndefined();
  });

  it('discards every entry when alias is not an object literal', () => {
    expect(raw(`{ alias: makeAliases() }`).entries).toBeUndefined();
  });

  it('reports no alias property as no entries, not as unknowable', () => {
    expect(raw(`{ paths: { base: '/x' } }`).entries).toEqual([]);
  });

  it('reads a literal kit.files.lib', () => {
    expect(raw(`{ files: { lib: 'src/library' } }`).filesLib).toBe('src/library');
  });

  it('records a non-literal kit.files.lib as unreadable (null), not absent', () => {
    // A present-but-unreadable files.lib must stay distinguishable from an absent one — see
    // RawKitAliases.filesLib's three states. Collapsing this into undefined is exactly the bug:
    // it lets compileKitAliases fall back to the 'src/lib' default for a project that moved
    // $lib to something this parser simply couldn't read.
    expect(raw(`{ files: { lib: someDir } }`).filesLib).toBeNull();
  });

  it('reports an absent kit.files.lib as undefined, distinct from an unreadable one', () => {
    expect(raw(`{ paths: { base: '/x' } }`).filesLib).toBeUndefined();
  });

  it('returns empty entries for an unparseable config', () => {
    expect(findKitAliasesInSvelteConfig(`export default { kit: {`)).toEqual({ entries: [] });
  });
});

describe('resolveKitAliases', () => {
  const svelte = (body: string) => ({ source: `export default { kit: ${body} };` });
  const list = (body: string) => resolveKitAliases(undefined, svelte(body));

  it('puts $lib first, then the user entries in declaration order', () => {
    expect(list(`{ alias: { '$b': 'src/b', '$a': 'src/a' } }`)).toEqual([
      { find: '$lib', replacement: 'src/lib', match: 'prefix' },
      { find: '$b', replacement: 'src/b', match: 'prefix' },
      { find: '$a', replacement: 'src/a', match: 'prefix' }
    ]);
  });

  it('lets kit.files.lib move $lib', () => {
    expect(list(`{ files: { lib: 'src/library' } }`)![0]).toEqual({
      find: '$lib',
      replacement: 'src/library',
      match: 'prefix'
    });
  });

  it('keeps files.lib ahead of a user $lib entry, which is therefore dead', () => {
    // Kit prepends its own $lib entry, and Vite takes the first match, so a user
    // kit.alias.$lib never fires.
    const l = list(`{ files: { lib: 'src/library' }, alias: { '$lib': 'src/mine' } }`)!;
    expect(l[0]).toEqual({ find: '$lib', replacement: 'src/library', match: 'prefix' });
    expect(l[1]).toEqual({ find: '$lib', replacement: 'src/mine', match: 'prefix' });
  });

  it('compiles a /* key to a contents entry with the star stripped from both sides', () => {
    expect(list(`{ alias: { '$a/*': 'src/a/*' } }`)![1]).toEqual({
      find: '$a',
      replacement: 'src/a',
      match: 'contents'
    });
  });

  it('narrows a plain key to exact when its /* form is also declared', () => {
    expect(list(`{ alias: { '$a': 'src/plain', '$a/*': 'src/star' } }`)!.slice(1)).toEqual([
      { find: '$a', replacement: 'src/plain', match: 'exact' },
      { find: '$a', replacement: 'src/star', match: 'contents' }
    ]);
  });

  it('assigns exact from the declared key set even when the /* value is unreadable', () => {
    const src = [
      `import path from 'node:path';`,
      `export default { kit: { alias: { '$a': 'src/plain', '$a/*': path.resolve('x') } } };`
    ].join('\n');
    expect(resolveKitAliases(undefined, { source: src })!.slice(1)).toEqual([
      { find: '$a', replacement: 'src/plain', match: 'exact' },
      { find: '$a', replacement: null, match: 'contents' }
    ]);
  });

  it('normalises a trailing slash, a backslash path, and a trailing star', () => {
    expect(list(`{ alias: { '$a': 'src/', '$b': 'src\\\\lib', '$c': 'src/c/*' } }`)!.slice(1)).toEqual([
      { find: '$a', replacement: 'src', match: 'prefix' },
      { find: '$b', replacement: 'src/lib', match: 'prefix' },
      { find: '$c', replacement: 'src/c', match: 'prefix' }
    ]);
  });

  it('normalises the $lib entry too, which Kit builds without posixify or resolve', () => {
    expect(list(`{ files: { lib: 'src/library/' } }`)![0]!.replacement).toBe('src/library');
  });

  it('compiles a computed kit.files.lib to an opaque $lib entry rather than the src/lib default', () => {
    expect(list(`{ files: { lib: someDir } }`)![0]).toEqual({ find: '$lib', replacement: null, match: 'prefix' });
  });

  it('keeps only $lib when the alias key set is unknowable', () => {
    const src = [`const shared = {};`, `export default { kit: { alias: { ...shared, '$a': 'src/a' } } };`].join('\n');
    expect(resolveKitAliases(undefined, { source: src })).toEqual([
      { find: '$lib', replacement: 'src/lib', match: 'prefix' }
    ]);
  });

  it('is undefined when there is no svelte config at all', () => {
    expect(resolveKitAliases(undefined, undefined)).toBeUndefined();
  });

  it('reads nothing when the Vite config carries a sveltekit() config, which makes svelte.config ignored', () => {
    const vite = {
      source: [
        `import { sveltekit } from '@sveltejs/kit/vite';`,
        `export default { plugins: [sveltekit({ alias: { '$a': 'src/a' } })] };`
      ].join('\n')
    };
    expect(resolveKitAliases(vite, svelte(`{ alias: { '$a': 'src/a' } }`))).toBeUndefined();
  });

  it('still reads svelte.config when sveltekit() takes no argument', () => {
    const vite = {
      source: [`import { sveltekit } from '@sveltejs/kit/vite';`, `export default { plugins: [sveltekit()] };`].join(
        '\n'
      )
    };
    expect(resolveKitAliases(vite, svelte(`{ alias: { '$a': 'src/a' } }`))!.slice(1)).toEqual([
      { find: '$a', replacement: 'src/a', match: 'prefix' }
    ]);
  });
});
