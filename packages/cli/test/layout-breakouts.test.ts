import { describe, it, expect } from 'vitest';
import { chainFiles, deriveRoute, collectRoutes } from '../src/providers/source/routes.js';
import { enumerateRoutePages } from '../src/providers/source/project.js';
import { createMemoryRuntime } from './helpers/memory-runtime.js';

const L = (dir: string, file = '+layout.svelte') => [dir, `${dir}/${file}`] as const;

// Layout index for the (app)/item/[id]/embed example from the SvelteKit docs.
const layouts = new Map<string, string>([
  L('src/routes'),
  L('src/routes/(app)'),
  L('src/routes/(app)/item'),
  L('src/routes/(app)/item/[id]')
]);
const rels = (page: string, map = layouts) => chainFiles(page, map).map((f) => f.rel);

describe('chainFiles — breakout resolution (#12)', () => {
  it('default page inherits the full ancestor layout chain', () => {
    expect(rels('src/routes/(app)/item/[id]/embed/+page.svelte')).toEqual([
      'src/routes/+layout.svelte',
      'src/routes/(app)/+layout.svelte',
      'src/routes/(app)/item/+layout.svelte',
      'src/routes/(app)/item/[id]/+layout.svelte',
      'src/routes/(app)/item/[id]/embed/+page.svelte'
    ]);
  });

  it('+page@ resets to the root layout only', () => {
    expect(rels('src/routes/(app)/item/[id]/embed/+page@.svelte')).toEqual([
      'src/routes/+layout.svelte',
      'src/routes/(app)/item/[id]/embed/+page@.svelte'
    ]);
  });

  it('+page@(group) resets to the group layout', () => {
    expect(rels('src/routes/(app)/item/[id]/embed/+page@(app).svelte')).toEqual([
      'src/routes/+layout.svelte',
      'src/routes/(app)/+layout.svelte',
      'src/routes/(app)/item/[id]/embed/+page@(app).svelte'
    ]);
  });

  it('+page@segment resets to that named ancestor layout (skips deeper layouts)', () => {
    expect(rels('src/routes/(app)/item/[id]/embed/+page@item.svelte')).toEqual([
      'src/routes/+layout.svelte',
      'src/routes/(app)/+layout.svelte',
      'src/routes/(app)/item/+layout.svelte',
      'src/routes/(app)/item/[id]/embed/+page@item.svelte'
    ]);
  });

  it('+layout@ on an intermediate layout skips its parent for all children', () => {
    // (app)/item/+layout@.svelte resets to root, so (app)/+layout.svelte is skipped.
    const map = new Map<string, string>([
      L('src/routes'),
      L('src/routes/(app)'),
      L('src/routes/(app)/item', '+layout@.svelte'),
      L('src/routes/(app)/item/[id]')
    ]);
    expect(rels('src/routes/(app)/item/[id]/+page.svelte', map)).toEqual([
      'src/routes/+layout.svelte',
      'src/routes/(app)/item/+layout@.svelte',
      'src/routes/(app)/item/[id]/+layout.svelte',
      'src/routes/(app)/item/[id]/+page.svelte'
    ]);
  });

  it('falls back to the default chain when the @segment is unknown', () => {
    expect(rels('src/routes/(app)/item/+page@nope.svelte')).toEqual([
      'src/routes/+layout.svelte',
      'src/routes/(app)/+layout.svelte',
      'src/routes/(app)/item/+layout.svelte',
      'src/routes/(app)/item/+page@nope.svelte'
    ]);
  });
});

describe('deriveRoute — breakout filenames (#12)', () => {
  it('derives the URL from the directory, ignoring @ and (groups)', () => {
    expect(deriveRoute('src/routes/(app)/item/[id]/embed/+page@(app).svelte')).toBe('/item/[id]/embed');
    expect(deriveRoute('src/routes/+page@.svelte')).toBe('/');
  });
});

describe('enumerateRoutePages — includes +page@ breakouts (#12)', () => {
  it('enumerates both +page.svelte and +page@x.svelte', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+page.svelte': 'x',
      'src/routes/(app)/item/+page@.svelte': 'y'
    });
    expect(await enumerateRoutePages(rt, '')).toEqual([
      'src/routes/(app)/item/+page@.svelte',
      'src/routes/+page.svelte'
    ]);
  });
});

describe('collectRoutes — breakout page does not inherit skipped layout tags (#12)', () => {
  it('a +page@ (root) page ignores the group layout title', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+layout.svelte': '<svelte:head><meta name="description" content="root" /></svelte:head>',
      'src/routes/(app)/+layout.svelte': '<svelte:head><title>App Layout Title</title></svelte:head>',
      'src/routes/(app)/page/+page@.svelte': '<h1>Breakout</h1>'
    });
    const { heads } = await collectRoutes(rt, '');
    const head = heads.find((h) => h.route === '/page')!;
    // Inherits the root layout's description, but NOT the (app) layout's title.
    expect(head.tags.some((t) => t.kind === 'meta' && t.name === 'description')).toBe(true);
    expect(head.tags.some((t) => t.kind === 'title')).toBe(false);
  });
});
