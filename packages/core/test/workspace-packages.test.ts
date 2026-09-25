import { describe, it, expect } from 'vitest';
import { resolveRepoLocalPath } from '../src/kit-module-parse.js';
import { resolveKitAliases } from '../src/svelte-config-parse.js';
import {
  declaredLocalPackages,
  packageJsonWorkspaceGlobs,
  pnpmWorkspaceGlobs,
  withWorkspacePackages
} from '../src/workspace-packages.js';

type Manifest = Record<string, unknown>;
const ui = (manifest: Manifest) => ({ name: '@repo/ui', dir: '../../packages/ui', manifest: JSON.stringify(manifest) });
const resolve = (spec: string, manifest: Manifest, importer = 'src/routes/+page.svelte') =>
  resolveRepoLocalPath(spec, importer, withWorkspacePackages(undefined, [ui(manifest)]));

describe('declaredLocalPackages', () => {
  it('keeps workspace:, link: and file: dependencies from every dependency field', () => {
    const pkg = JSON.stringify({
      dependencies: { '@repo/ui': 'workspace:*', svelte: '^5.0.0', '@repo/renamed': 'workspace:@repo/other@*' },
      devDependencies: { '@repo/cfg': 'workspace:^1.0.0', '@repo/linked': 'link:../../packages/linked' },
      peerDependencies: { '@repo/file': 'file:../file' }
    });
    expect([...declaredLocalPackages(pkg).keys()]).toEqual(['@repo/ui', '@repo/cfg', '@repo/linked', '@repo/file']);
  });

  it('is empty for an unparseable or absent package.json', () => {
    expect(declaredLocalPackages('{')).toEqual(new Map());
    expect(declaredLocalPackages(undefined)).toEqual(new Map());
  });
});

describe('workspace globs', () => {
  it('reads pnpm-workspace.yaml packages in block form, with quotes, comments and negations', () => {
    const yaml = [
      '# root',
      'packages:',
      "  - 'apps/*'",
      '  # shared code',
      '  - "packages/*" # comment',
      '  - !apps/db-agent',
      'onlyBuiltDependencies:',
      '  - esbuild'
    ].join('\n');
    expect(pnpmWorkspaceGlobs(yaml)).toEqual(['apps/*', 'packages/*', '!apps/db-agent']);
  });

  it('reads pnpm-workspace.yaml packages in flow form', () => {
    expect(pnpmWorkspaceGlobs(`packages: ['apps/*', "packages/*"]\n`)).toEqual(['apps/*', 'packages/*']);
  });

  it('reads package.json workspaces as an array or as { packages }', () => {
    expect(packageJsonWorkspaceGlobs(JSON.stringify({ workspaces: ['packages/*'] }))).toEqual(['packages/*']);
    expect(packageJsonWorkspaceGlobs(JSON.stringify({ workspaces: { packages: ['libs/*'] } }))).toEqual(['libs/*']);
    expect(packageJsonWorkspaceGlobs(JSON.stringify({ name: 'app' }))).toBeUndefined();
  });
});

describe('withWorkspacePackages', () => {
  it('leaves the list untouched when the app declares no workspace package', () => {
    const kit = resolveKitAliases(undefined, { source: `export default { kit: {} };` });
    expect(withWorkspacePackages(kit, [])).toBe(kit);
    expect(withWorkspacePackages(undefined, [])).toBeUndefined();
  });

  it('resolves an exports wildcard, and an exact subpath ahead of it', () => {
    const manifest = {
      exports: {
        '.': { types: './index.ts', svelte: './index.ts' },
        './components/*': './src/components/*',
        './components/settings': './src/components/settings/index.ts'
      }
    };
    expect(resolve('@repo/ui/components/MetaTags.svelte', manifest)).toBe(
      '../../packages/ui/src/components/MetaTags.svelte'
    );
    expect(resolve('@repo/ui/components/settings', manifest)).toBe(
      '../../packages/ui/src/components/settings/index.ts'
    );
    expect(resolve('@repo/ui', manifest)).toBe('../../packages/ui/index.ts');
    // Not exported: Node refuses it, so it stays unresolved.
    expect(resolve('@repo/ui/src/components/MetaTags.svelte', manifest)).toBeUndefined();
    // A name that only shares a prefix with the package is another package.
    expect(resolve('@repo/ui-kit/x', manifest)).toBeUndefined();
  });

  it('walks conditions in declaration order and leaves environment-dependent ones unresolved', () => {
    expect(
      resolve('@repo/ui', { exports: { types: './a.d.ts', svelte: './src/index.ts', default: './dist/index.js' } })
    ).toBe('../../packages/ui/src/index.ts');
    expect(resolve('@repo/ui', { exports: { import: './dist/index.js', svelte: './src/index.ts' } })).toBe(
      '../../packages/ui/dist/index.js'
    );
    expect(resolve('@repo/ui', { exports: './src/index.ts' })).toBe('../../packages/ui/src/index.ts');
    expect(
      resolve('@repo/ui/x', { exports: { './x': { browser: './src/x.ts', default: './src/y.ts' } } })
    ).toBeUndefined();
  });

  it('keeps an unfollowable pattern as a blocking entry rather than letting a shorter one answer', () => {
    const manifest = { exports: { './*': './src/*', './icons/*': './src/icons/*.svelte', './internal/*': null } };
    expect(resolve('@repo/ui/button.svelte', manifest)).toBe('../../packages/ui/src/button.svelte');
    expect(resolve('@repo/ui/icons/x', manifest)).toBeUndefined();
    expect(resolve('@repo/ui/internal/x', manifest)).toBeUndefined();
  });

  it('refuses an exports target that leaves the package directory', () => {
    expect(resolve('@repo/ui/x', { exports: { './x': '../../../../etc/x.ts' } })).toBeUndefined();
    expect(resolve('@repo/ui/x', { exports: { './x': './../other/x.ts' } })).toBeUndefined();
  });

  it('reads the file layout when the package has no exports', () => {
    expect(resolve('@repo/ui/src/Button.svelte', { name: '@repo/ui' })).toBe('../../packages/ui/src/Button.svelte');
  });

  it("resolves relative imports between the package's files, and nothing else above the project root", () => {
    const manifest = { exports: { '.': './index.ts' } };
    expect(resolve('./src/Title.svelte', manifest, '../../packages/ui/index.ts')).toBe(
      '../../packages/ui/src/Title.svelte'
    );
    expect(resolve('../other/x.svelte', manifest, '../../packages/ui/index.ts')).toBeUndefined();
    expect(resolve('../../../x.svelte', manifest)).toBeUndefined();
  });

  it('points a kit.alias into node_modules/<package> at the package directory', () => {
    const kit = resolveKitAliases(undefined, {
      source: `import path from 'path';
export default { kit: { alias: {
  '@cio/ui': path.resolve('./node_modules/@cio/ui/src'),
  '@cio/ui/*': path.resolve('./node_modules/@cio/ui/src/*'),
  '$other': path.resolve('./node_modules/other/src')
} } };`
    });
    const aliases = withWorkspacePackages(kit, [
      { name: '@cio/ui', dir: '../../packages/ui', manifest: JSON.stringify({ name: '@cio/ui' }) }
    ]);
    expect(resolveRepoLocalPath('@cio/ui/base/page', 'src/routes/+page.svelte', aliases)).toBe(
      '../../packages/ui/src/base/page'
    );
    expect(resolveRepoLocalPath('./page-title.svelte', '../../packages/ui/src/base/page/index.ts', aliases)).toBe(
      '../../packages/ui/src/base/page/page-title.svelte'
    );
    // An npm package in node_modules is not a workspace package.
    expect(resolveRepoLocalPath('$other/x', 'src/routes/+page.svelte', aliases)).toBe('node_modules/other/src/x');
  });
});
