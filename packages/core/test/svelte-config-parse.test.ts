import { describe, it, expect } from 'vitest';
import {
  findKitPathsBaseInSvelteConfig,
  findKitPathsBaseInViteConfig,
  resolveKitPathsBase,
  findKitAliasesInSvelteConfig,
  resolveKitAliases,
  withPackageImports,
  resolveKitHashRouter,
  findKitHashRouterInSvelteConfig,
  normalizeAliasValue
} from '../src/svelte-config-parse.js';
import { resolveRepoLocalPath } from '../src/kit-module-parse.js';
import { DEFAULT_KIT_ALIASES } from '../src/kit-module-parse.js';

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

  it('ignores a computed base whose every outcome is the empty string', () => {
    for (const base of [`process.env.NODE_ENV === 'production' ? '' : ''`, `a ? '' : b ? '' : ''`, `'' || ''`]) {
      expect(
        findKitPathsBaseInSvelteConfig(`export default { kit: { paths: { base: ${base} } } };`),
        base
      ).toBeUndefined();
    }
  });

  it('ignores a base SvelteKit refuses to load (not starting with /, or ending with /)', () => {
    for (const base of [`process.env.TAURI ? './' : ''`, `'./'`, `'/app/'`, `x ? 'app' : ''`]) {
      expect(
        findKitPathsBaseInSvelteConfig(`export default { kit: { paths: { base: ${base} } } };`),
        base
      ).toBeUndefined();
    }
  });

  it('keeps a computed base with a non-empty or non-literal outcome as present-but-unknown', () => {
    for (const base of [`x ? '' : '/repo'`, `x ? './' : '/repo'`, `x ? '' : y`, `process.env.BASE ?? ''`]) {
      expect(findKitPathsBaseInSvelteConfig(`export default { kit: { paths: { base: ${base} } } };`), base).toEqual({});
    }
  });

  it('ignores an empty-string base', () => {
    expect(findKitPathsBaseInSvelteConfig(`export default { kit: { paths: { base: '' } } };`)).toBeUndefined();
  });

  it('follows a base named by a top-level const', () => {
    const decl = (init: string) =>
      `const base = ${init};\nexport default { kit: { paths: { relative: false, base } } };`;
    expect(findKitPathsBaseInSvelteConfig(decl(`''`))).toBeUndefined();
    expect(findKitPathsBaseInSvelteConfig(decl(`'/repo'`))).toEqual({ value: '/repo' });
    expect(findKitPathsBaseInSvelteConfig(decl(`process.env.BASE ?? ''`))).toEqual({});
    const reassigned = `let base = '';\nif (process.env.CI) base = '/repo';\nexport default { kit: { paths: { base } } };`;
    expect(findKitPathsBaseInSvelteConfig(reassigned)).toEqual({});
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
      `export default { kit: { alias: { '$a': path.resolve(dir), '$b': 'src/b' } } };`
    ].join('\n');
    expect(findKitAliasesInSvelteConfig(src).entries).toEqual([
      { key: '$a', value: null },
      { key: '$b', value: 'src/b' }
    ]);
  });

  it('reads resolve/join of literals and fileURLToPath(new URL(literal, import.meta.url)) as root-relative paths', () => {
    const src = [
      `import path, { resolve } from 'node:path';`,
      `import { fileURLToPath } from 'node:url';`,
      `export default { kit: { alias: {`,
      `  $a: resolve('./src/features'),`,
      `  $b: path.resolve(__dirname, 'src', 'b'),`,
      `  $c: path.join(import.meta.dirname, './src/c/*'),`,
      `  $d: fileURLToPath(new URL('./src/d', import.meta.url)),`,
      `  $e: path.resolve('/opt/shared'),`,
      `  $f: path.resolve(root, 'src'),`,
      `  $g: fileURLToPath(new URL('./src/g', base))`,
      `}, files: { lib: path.resolve('./src/library') } } };`
    ].join('\n');
    expect(findKitAliasesInSvelteConfig(src)).toEqual({
      entries: [
        { key: '$a', value: './src/features' },
        { key: '$b', value: 'src/b' },
        { key: '$c', value: './src/c/*' },
        { key: '$d', value: './src/d' },
        { key: '$e', value: '/opt/shared' },
        { key: '$f', value: null },
        { key: '$g', value: null }
      ],
      filesLib: './src/library'
    });
    expect(resolveKitAliases(undefined, { source: src })!.map((a) => a.replacement)).toEqual([
      'src/library',
      'src/features',
      'src/b',
      'src/c',
      'src/d',
      '/opt/shared',
      null,
      null
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
      `export default { kit: { alias: { '$a': 'src/plain', '$a/*': path.resolve(dir) } } };`
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

  const pluginWith = (arg: string) => ({
    source: `import { sveltekit } from '@sveltejs/kit/vite';\nexport default { plugins: [sveltekit(${arg})] };`
  });
  const svelteWithAlias = svelte(`{ alias: { '$b': 'src/b' } }`);

  it('reads alias from the sveltekit() plugin options, which make svelte.config ignored', () => {
    expect(resolveKitAliases(pluginWith(`{ alias: { '$a': 'src/a' } }`), svelteWithAlias)).toEqual([
      { find: '$lib', replacement: 'src/lib', match: 'prefix' },
      { find: '$a', replacement: 'src/a', match: 'prefix' }
    ]);
  });

  it('reads files.lib from the sveltekit() plugin options', () => {
    expect(resolveKitAliases(pluginWith(`{ files: { lib: 'app/lib' } }`), undefined)).toEqual([
      { find: '$lib', replacement: 'app/lib', match: 'prefix' }
    ]);
  });

  it('lets a $lib alias in plugin options stand in for the built-in entry, which SvelteKit 3 no longer adds', () => {
    expect(resolveKitAliases(pluginWith(`{ alias: { '$lib': 'app/lib', '$a': 'src/a' } }`), undefined)).toEqual([
      { find: '$lib', replacement: 'app/lib', match: 'prefix' },
      { find: '$a', replacement: 'src/a', match: 'prefix' }
    ]);
    // SvelteKit 2 puts files.lib first, so a user $lib entry beside it stays dead.
    expect(
      resolveKitAliases(pluginWith(`{ files: { lib: 'src/library' }, alias: { '$lib': 'app/lib' } }`), undefined)![0]
    ).toEqual({ find: '$lib', replacement: 'src/library', match: 'prefix' });
  });

  it('gives plugin options without an alias the default $lib list', () => {
    expect(resolveKitAliases(pluginWith(`{ paths: { base: '/x' } }`), svelteWithAlias)).toEqual(DEFAULT_KIT_ALIASES);
  });

  it('reads nothing from plugin options it cannot resolve', () => {
    expect(resolveKitAliases(pluginWith('opts'), svelteWithAlias)).toBeUndefined();
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

describe('withPackageImports', () => {
  const pkg = (imports: unknown) => JSON.stringify({ imports });

  it('appends subpath and exact entries after the Kit aliases', () => {
    const kit = resolveKitAliases(undefined, { source: `export default { kit: { alias: { $x: 'src/x' } } };` });
    expect(withPackageImports(kit, pkg({ '#lib/*': './src/lib/*', '#lib': './src/lib/index.js' }))).toEqual([
      ...kit!,
      { find: '#lib', replacement: 'src/lib/index.js', match: 'exact' },
      { find: '#lib', replacement: 'src/lib', match: 'contents' }
    ]);
  });

  it('starts from the default $lib alias when no Kit config was read', () => {
    expect(withPackageImports(undefined, pkg({ '#ui/*': { default: './src/ui/*' } }))).toEqual([
      { find: '$lib', replacement: 'src/lib', match: 'prefix' },
      { find: '#ui', replacement: 'src/ui', match: 'contents' }
    ]);
  });

  it('resolves conditions in declaration order and leaves environment-dependent ones unresolved', () => {
    const find = (imports: unknown) => withPackageImports(undefined, pkg(imports))?.slice(1);
    expect(find({ '#a': { types: './a.d.ts', import: './src/a.js', default: './src/fallback.js' } })).toEqual([
      { find: '#a', replacement: 'src/a.js', match: 'exact' }
    ]);
    expect(find({ '#b': { node: './src/b-node.js', default: './src/b.js' } })).toBeUndefined();
  });

  it('orders exact keys first, then longer patterns, whatever the declaration order', () => {
    const list = withPackageImports(
      undefined,
      pkg({ '#lib/*': './src/lib/*', '#lib/ui/*': './src/ui/*', '#lib/special': './src/special.js' })
    )!;
    expect(list.slice(1).map((a) => a.find)).toEqual(['#lib/special', '#lib/ui', '#lib']);
  });

  it('skips package targets, mid-key wildcards and unreadable package.json', () => {
    expect(withPackageImports(undefined, pkg({ '#dep': 'some-package', '#a/*/b': './a/*/b' }))).toBeUndefined();
    expect(withPackageImports(undefined, '{ not json')).toBeUndefined();
    expect(withPackageImports(undefined, undefined)).toBeUndefined();
  });
});

describe('resolveKitHashRouter', () => {
  const fromSvelteConfig = (source: string) => resolveKitHashRouter(undefined, { source });
  it("reads kit.router.type: 'hash'", () => {
    expect(fromSvelteConfig(`export default { kit: { router: { type: 'hash' } } };`)).toBe(true);
    expect(
      fromSvelteConfig(
        `const config = { kit: { adapter: adapter(), router: { type: 'hash' } } };\nexport default config;`
      )
    ).toBe(true);
  });
  it('is false for the pathname router or no router', () => {
    expect(fromSvelteConfig(`export default { kit: { router: { type: 'pathname' } } };`)).toBe(false);
    expect(fromSvelteConfig(`export default { kit: {} };`)).toBe(false);
    expect(fromSvelteConfig(`export default { kit: { router: { type: mode } } };`)).toBe(false);
  });
  it('is false when another value could override the literal', () => {
    const hash = `{ kit: { router: { type: 'hash' } } }`;
    expect(fromSvelteConfig(`export default defineConfig(${hash});`)).toBe(true);
    expect(fromSvelteConfig(`export default mergeConfigs(${hash}, base);`)).toBe(false);
    expect(fromSvelteConfig(`export default { ...base, kit: { router: { type: 'hash' } } };`)).toBe(false);
    expect(fromSvelteConfig(`export default { kit: { router: { type: 'hash', ...extra } } };`)).toBe(false);
  });
  const vite = (arg: string) => ({
    source: `import { sveltekit } from '@sveltejs/kit/vite';\nexport default { plugins: [sveltekit(${arg})] };`
  });
  const svelte = { source: "export default { kit: { router: { type: 'hash' } } };" };
  it('reads router.type from the sveltekit() plugin options', () => {
    expect(resolveKitHashRouter(vite("{ router: { type: 'hash' } }"), undefined)).toBe(true);
    expect(resolveKitHashRouter(vite("{ router: { type: 'pathname' } }"), undefined)).toBe(false);
    expect(resolveKitHashRouter(vite("{ ...base, router: { type: 'hash' } }"), undefined)).toBe(false);
    expect(resolveKitHashRouter(vite("mergeConfigs({ router: { type: 'hash' } }, base)"), undefined)).toBe(false);
  });
  it('lets plugin options decide over svelte.config, and stays silent on unresolvable ones', () => {
    expect(resolveKitHashRouter(vite("{ paths: { base: '/x' } }"), svelte)).toBe(false);
    expect(resolveKitHashRouter(vite('opts'), svelte)).toBe(false);
  });
  it('reads svelte.config when the plugin carries no options', () => {
    expect(resolveKitHashRouter(vite(''), svelte)).toBe(true);
    expect(resolveKitHashRouter(undefined, svelte)).toBe(true);
    expect(resolveKitHashRouter(undefined, undefined)).toBe(false);
  });
});

describe('svelte-config path values', () => {
  it('reads the root directory in every form and nothing that only looks like it', () => {
    const src = [
      `import path from 'node:path';`,
      `import { fileURLToPath } from 'node:url';`,
      `export default { kit: { alias: {`,
      `  $h: path.resolve(process.cwd(), 'src/h'),`,
      `  $p: path.resolve(os.cwd(), 'src/p'),`,
      `  $q: path.resolve(process.exit(), 'src/q'),`,
      `  $r: path.resolve(import.meta.url, 'src/r'),`,
      `  $s: path.resolve(foo.dirname, 'src/s'),`,
      `  $i: fileURLToPath(new URL('./src/i', other.url)),`,
      `  $j: fileURLToPath(new URL('./src/j', import.meta.dirname)),`,
      `  $k: path.normalize('./src/k'),`,
      `  $l: path.resolve('src', __dirname),`,
      `  $m: path.join('/opt', '/shared'),`,
      `  $n: path.resolve('src', '/abs'),`,
      `  $o: path.resolve('src/', 'o'),`,
      `  $t: path.resolve(cwd(), 'src/t')`,
      `} } };`
    ].join('\n');
    expect(findKitAliasesInSvelteConfig(src).entries).toEqual([
      { key: '$h', value: 'src/h' },
      { key: '$p', value: null },
      { key: '$q', value: null },
      { key: '$r', value: null },
      { key: '$s', value: null },
      { key: '$i', value: null },
      { key: '$j', value: null },
      { key: '$k', value: null },
      { key: '$l', value: null },
      { key: '$m', value: '/opt//shared' },
      { key: '$n', value: '/abs' },
      { key: '$o', value: 'src//o' },
      { key: '$t', value: null }
    ]);
  });

  it('gives a config without an exported object no entries', () => {
    expect(findKitAliasesInSvelteConfig('const x = 1;')).toEqual({ entries: [] });
    expect(findKitAliasesInSvelteConfig('export default { other: 1 };')).toEqual({ entries: [] });
  });

  it('normalizes only leading ./ runs and every trailing slash', () => {
    expect(['././src/lib', 'src/lib//', 'a/./b', 'src\\lib/*'].map(normalizeAliasValue)).toEqual([
      'src/lib',
      'src/lib',
      'a/./b',
      'src/lib'
    ]);
  });
});

describe('withPackageImports — key and target shapes', () => {
  it('skips a pattern whose target is not one, a target pattern under an exact key, and a key with a * mid-way', () => {
    const imports = { '#a/*': './src/a', '#b': './src/b/*', '#x*y': './src/xy', '#a*b/*': './src/ab/*' };
    expect(withPackageImports(undefined, JSON.stringify({ imports }))).toBeUndefined();
  });

  it('puts an exact key ahead of a pattern that also covers it', () => {
    const aliases = withPackageImports(
      undefined,
      JSON.stringify({ imports: { '#lib/*': './src/lib/*', '#lib/x': './src/special/x.ts' } })
    );
    expect(resolveRepoLocalPath('#lib/x', 'src/routes/+page.ts', aliases)).toBe('src/special/x.ts');
    expect(resolveRepoLocalPath('#lib/y', 'src/routes/+page.ts', aliases)).toBe('src/lib/y');
  });
});

describe('config object resolution depth', () => {
  const chain = (hops: number) => {
    const names = Array.from({ length: hops }, (_, i) => `c${i}`);
    return [
      `const c0 = { kit: { router: { type: 'hash' } } };`,
      ...names.slice(1).map((n, i) => `const ${n} = ${names[i]};`),
      `export default ${names.at(-1)};`
    ].join('\n');
  };
  it('follows an exported config through two aliases and no further', () => {
    expect(findKitHashRouterInSvelteConfig(chain(3))).toBe(true);
    expect(findKitHashRouterInSvelteConfig(chain(4))).toBe(false);
    expect(findKitHashRouterInSvelteConfig('export default {')).toBe(false);
  });
  it('follows a base through three aliases and no further', () => {
    const base = (hops: number) =>
      [
        `const b0 = '/docs';`,
        ...Array.from({ length: hops - 1 }, (_, i) => `const b${i + 1} = b${i};`),
        `export default { kit: { paths: { base: b${hops - 1} } } };`
      ].join('\n');
    expect(findKitPathsBaseInSvelteConfig(base(4))).toEqual({ value: '/docs' });
    expect(findKitPathsBaseInSvelteConfig(base(5))).toEqual({});
  });
});

describe('sveltekit plugin detection', () => {
  it('assumes the bare name only without an import, and takes only the plugin call', () => {
    const noImport = `export default { plugins: [other({ paths: { base: '/wrong' } }), sveltekit({ paths: { base: '/docs' } })] };`;
    expect(findKitPathsBaseInViteConfig(noImport)).toEqual({ kind: 'resolved', base: { value: '/docs' } });
    const aliased = [
      `import { sveltekit as kit } from '@sveltejs/kit/vite';`,
      `const sveltekit = (o) => o;`,
      `export default { plugins: [sveltekit({ paths: { base: '/wrong' } }), kit({ paths: { base: '/docs' } })] };`
    ].join('\n');
    expect(findKitPathsBaseInViteConfig(aliased)).toEqual({ kind: 'resolved', base: { value: '/docs' } });
  });
});
