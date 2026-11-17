import { describe, it, expect } from 'vitest';
import {
  appSsrDisabled,
  layoutNeverRenders,
  pageRendersOnlyWhenBuilding,
  routeGated,
  universalNeverCsr,
  universalNeverSsr
} from '../src/kit-module.js';
import type { KitModuleFacts } from '../src/kit-module.js';
import { emptyKitModuleFacts } from '../src/kit-module-collect.js';

const mod = (file: string, extra: Partial<KitModuleFacts> = {}): KitModuleFacts => ({
  ...emptyKitModuleFacts(file, file.includes('.server.') ? 'server' : 'universal'),
  ...extra
});

describe('layoutNeverRenders', () => {
  const scope = {
    kitModules: [
      mod('src/routes/+layout.server.ts', { loadNeverRenders: true }),
      mod('src/routes/admin/+layout.server.ts', { loadNeverRenders: true }),
      mod('src/routes/shop/+layout.ts'),
      mod('src/routes/admin/users/+page.server.ts'),
      mod('src/routes/a/b/c/+layout.server.ts', { loadNeverRenders: true }),
      mod('src/routes/k/l/+layout.server.ts', { loadNeverRenders: true })
    ],
    sourceFiles: [
      'src/routes/admin/y/+page.ts',
      'src/routes/admin/y/+page@.svelte',
      'src/routes/admin/+page.svelte',
      'src/routes/a/b/c/d/+page@b.svelte',
      'src/routes/k/l/m/+page@l.svelte',
      'src/routes/+layout.svelte',
      'src/routes/+page.svelte',
      'src/routes/admin/+layout.svelte',
      'src/routes/admin/users/+page.svelte',
      'src/routes/admin/(x)/reset/+page@.svelte',
      'src/routes/shop/+page.svelte'
    ]
  };
  it('holds for a page under a non-root layout whose load always exits, and only there', () => {
    const pages = [
      'src/routes/admin/users/+page.svelte',
      'src/routes/admin/users/+page.server.ts',
      'src/routes/admin/(x)/reset/+page@.svelte',
      'src/routes/shop/+page.svelte',
      'src/routes/+page.svelte',
      'src/routes/admin/+layout.svelte',
      'src/lib/x.ts',
      'src/routes/admin/+page.svelte',
      'src/routes/admin/y/+page@.svelte',
      'src/routes/a/b/c/d/+page@b.svelte',
      'src/routes/k/l/m/+page@l.svelte'
    ];
    expect(pages.map((p) => layoutNeverRenders(p, scope))).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      true,
      false,
      false,
      true
    ]);
  });
});

describe('pageRendersOnlyWhenBuilding', () => {
  const scope = {
    kitModules: [
      mod('src/routes/docs/+page.server.ts', { loadNeverRendersOutsideBuild: true }),
      mod('src/routes/blog/+page.ts', { loadNeverRendersOutsideBuild: true }),
      mod('src/routes/blog/+page.server.ts', { prerenderExported: true }),
      mod('src/routes/guide/+page.ts', { loadNeverRendersOutsideBuild: true }),
      mod('src/routes/guide/+layout.ts', { prerenderExported: true }),
      mod('src/routes/news/+page.ts', { loadNeverRendersOutsideBuild: true }),
      mod('src/routes/other/+layout.ts', { prerenderExported: true }),
      mod('src/routes/elsewhere/+page.ts', { prerenderExported: true }),
      mod('src/routes/x/+layout.ts', { loadNeverRendersOutsideBuild: true }),
      mod('src/routes/deep/+layout.ts', { prerenderExported: true }),
      mod('src/routes/deep/page/+page.ts', { loadNeverRendersOutsideBuild: true }),
      mod('src/routes/+page.ts', { prerenderExported: true }),
      mod('src/routes/sub/+page.ts', { loadNeverRendersOutsideBuild: true })
    ],
    sourceFiles: [
      'src/routes/+layout.svelte',
      'src/routes/docs/+page.svelte',
      'src/routes/blog/+page.svelte',
      'src/routes/guide/+page.svelte',
      'src/routes/news/+page.svelte',
      'src/routes/x/+page.svelte'
    ]
  };
  it('holds for a page whose own load exits outside the build when nothing on its chain prerenders it', () => {
    const pages = [
      'src/routes/docs/+page.svelte',
      'src/routes/blog/+page.svelte',
      'src/routes/guide/+page.svelte',
      'src/routes/news/+page.svelte',
      'src/routes/x/+page.svelte',
      'src/routes/docs/+layout.svelte',
      'src/lib/x.ts',
      'src/routes/deep/page/+page.ts',
      'src/routes/sub/+page.ts'
    ];
    expect(pages.map((p) => pageRendersOnlyWhenBuilding(p, scope))).toEqual([
      true,
      false,
      false,
      true,
      false,
      false,
      false,
      false,
      true
    ]);
  });
});

describe('routeGated', () => {
  const scope = {
    kitModules: [
      mod('src/routes/admin/+layout.server.ts', { loadGated: true }),
      mod('src/routes/me/+page.server.ts', { loadGated: true }),
      mod('src/routes/open/+layout.ts', { loadGated: true })
    ],
    sourceFiles: [
      'src/routes/admin/+page.svelte',
      'src/routes/admin/+layout.svelte',
      'src/routes/me/+page.svelte',
      'src/routes/open/+page.svelte',
      'src/routes/(x)/+page@.svelte'
    ]
  };
  it('holds for a page behind a server load gate of its own or of a wrapping layout, and not for a layout', () => {
    const files = [
      'src/routes/admin/+page.svelte',
      'src/routes/admin/+layout.svelte',
      'src/routes/me/+page.svelte',
      'src/routes/open/+page.svelte'
    ];
    expect(files.map((f) => routeGated(f, scope))).toEqual([true, false, true, false]);
  });
  it('follows a reset to the root layout', () => {
    const rooted = {
      kitModules: [mod('src/routes/+layout.server.ts', { loadGated: true })],
      sourceFiles: ['src/routes/+layout.svelte', 'src/routes/(x)/+page@.svelte']
    };
    expect(routeGated('src/routes/(x)/+page@.svelte', rooted)).toBe(true);
  });
  it('does not take a universal load gate', () => {
    const universal = { ...scope, kitModules: [mod('src/routes/open/+layout.ts', { loadGated: true })] };
    expect(routeGated('src/routes/open/+page.svelte', universal)).toBe(false);
  });
});

describe('route render options', () => {
  it('reads an app-wide ssr = false from the root layout', () => {
    expect(
      appSsrDisabled({
        kitModules: [mod('src/routes/+layout.ts', { ssrDisabled: { line: 1 } }), mod('src/routes/a/+page.ts')]
      })
    ).toBe(true);
  });

  it('takes a root layout as never in the browser only when it opts out of csr itself', () => {
    const own = {
      kitModules: [mod('src/routes/+layout.ts', { csrDisabled: { line: 1 } }), mod('src/routes/a/+page.ts')],
      sourceFiles: ['src/routes/+layout.svelte', 'src/routes/a/+page.svelte']
    };
    expect(universalNeverCsr(own.kitModules[0]!, own)).toBe(true);
    const inherited = {
      kitModules: [mod('src/routes/+layout.ts'), mod('src/routes/a/+page.ts', { csrDisabled: { line: 1 } })],
      sourceFiles: ['src/routes/+layout.svelte', 'src/routes/a/+page.svelte']
    };
    expect(universalNeverCsr(inherited.kitModules[0]!, inherited)).toBe(false);
    expect(universalNeverCsr(inherited.kitModules[1]!, inherited)).toBe(true);
  });

  it('reads a non-root layout as never in the browser when every page under it is', () => {
    const scope = {
      kitModules: [
        mod('src/routes/app/+layout.ts', { csrDisabled: { line: 1 } }),
        mod('src/routes/app/+layout.server.ts')
      ],
      sourceFiles: ['src/routes/app/+layout.svelte', 'src/routes/app/a/+page.svelte']
    };
    expect(universalNeverCsr(scope.kitModules[0]!, scope)).toBe(true);
    expect(universalNeverCsr(scope.kitModules[1]!, scope)).toBe(false);
  });

  it('reads a layout as never in the browser only when every page under it is', () => {
    const scope = {
      kitModules: [
        mod('src/routes/app2/+layout.ts'),
        mod('src/routes/app2/b/+page.ts'),
        mod('src/routes/app2/a/+page.ts', { csrDisabled: { line: 1 } })
      ],
      sourceFiles: [
        'src/routes/app2/+layout.svelte',
        'src/routes/app2/b/+page.svelte',
        'src/routes/app2/a/+page.svelte'
      ]
    };
    expect(universalNeverCsr(scope.kitModules[0]!, scope)).toBe(false);
  });

  it("reads a universal module's own ssr = false even when a page under it turns ssr back on", () => {
    const scope = {
      kitModules: [
        mod('src/routes/app/+layout.ts', { ssrDisabled: { line: 1 } }),
        mod('src/routes/app/a/+page.ts', { ssrEnabled: true })
      ],
      sourceFiles: ['src/routes/app/+layout.svelte', 'src/routes/app/a/+page.svelte']
    };
    expect(universalNeverSsr(scope.kitModules[0]!, scope)).toBe(true);
    expect(universalNeverSsr(scope.kitModules[1]!, scope)).toBe(false);
  });
});
