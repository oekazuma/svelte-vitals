import { describe, it, expect } from 'vitest';
import { perf001ImageDimensions, perf002ImageLoading, defaultProject, defaultConfig } from '../src/index.js';
import type { ResolvedImages } from '../src/images.js';

const config = defaultConfig;
const img = (over: Partial<{ hasWidth: boolean; hasHeight: boolean; hasLoading: boolean }>) => ({
  hasWidth: true,
  hasHeight: true,
  hasLoading: true,
  line: 7,
  file: 'src/routes/+page.svelte',
  ...over
});
const ctxWith = (images: ResolvedImages[]) => ({ heads: [], images, project: defaultProject, config });

describe('PERF001 image dimensions', () => {
  it('flags an <img> missing width or height, with file and line', async () => {
    const ctx = ctxWith([{ route: '/a', images: [img({ hasWidth: false })] }]);
    const [r] = await perf001ImageDimensions.check(ctx);
    expect(r!.category).toBe('performance');
    expect(r!.severity).toBe('warning');
    expect(r!.route).toBe('/a');
    expect(r!.location).toBe('src/routes/+page.svelte');
    expect(r!.line).toBe(7);
    expect(r!.detection).toEqual({ presence: 'none', value: 'absent' });
  });

  it('passes an <img> with both dimensions (dynamic counts as present)', async () => {
    const ctx = ctxWith([{ route: '/a', images: [img({})] }]);
    const [r] = await perf001ImageDimensions.check(ctx);
    expect(r!.detection).toEqual({ presence: 'own', value: 'static' }); // a seeding pass result
  });

  it('emits one passing result for a route with no images', async () => {
    const ctx = ctxWith([{ route: '/empty', images: [] }]);
    const results = await perf001ImageDimensions.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0]!.detection.presence).toBe('own');
  });

  it('emits one finding per offending image', async () => {
    const ctx = ctxWith([{ route: '/a', images: [img({ hasWidth: false }), img({ hasHeight: false })] }]);
    const results = await perf001ImageDimensions.check(ctx);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.detection.presence === 'none')).toBe(true);
  });
});

describe('PERF001 image line omission when unknown (line: 0)', () => {
  it('omits line property when img.line === 0', async () => {
    const imgNoLine = { hasWidth: false, hasHeight: true, hasLoading: true, line: 0, file: 'src/routes/+page.svelte' };
    const ctx = ctxWith([{ route: '/a', images: [imgNoLine] }]);
    const [r] = await perf001ImageDimensions.check(ctx);
    expect('line' in r!).toBe(false);
    expect(r!.line).toBeUndefined();
  });

  it('still sets line when img.line > 0', async () => {
    const ctx = ctxWith([{ route: '/a', images: [img({ hasWidth: false })] }]);
    const [r] = await perf001ImageDimensions.check(ctx);
    expect(r!.line).toBe(7);
  });
});

describe('PERF002 image loading', () => {
  it('flags a missing loading attribute as info', async () => {
    const ctx = ctxWith([{ route: '/a', images: [img({ hasLoading: false })] }]);
    const [r] = await perf002ImageLoading.check(ctx);
    expect(r!.severity).toBe('info');
    expect(r!.category).toBe('performance');
    expect(r!.detection.presence).toBe('none');
  });
});
