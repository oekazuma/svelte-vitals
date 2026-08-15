import { describe, it, expect } from 'vitest';
import {
  performanceImageDimensions,
  performanceImageLoadingHint,
  defaultProject,
  defaultConfig
} from '../src/internal.js';
import type { ResolvedImages } from '../src/images.js';

const config = defaultConfig;
const img = (
  over: Partial<{
    hasWidth: boolean;
    hasHeight: boolean;
    hasLoading: boolean;
    hasAlt: boolean;
    lazy: boolean;
    hasSrcset: boolean;
  }>
) => ({
  hasWidth: true,
  hasHeight: true,
  hasLoading: true,
  hasAlt: true,
  lazy: false,
  hasSrcset: true,
  line: 7,
  file: 'src/routes/+page.svelte',
  ...over
});
const ctxWith = (images: ResolvedImages[]) => ({ heads: [], images, project: defaultProject, config });

describe('performance/image-dimensions image dimensions', () => {
  it('flags an <img> missing width or height, with file and line', async () => {
    const ctx = ctxWith([{ route: '/a', images: [img({ hasWidth: false })] }]);
    const [r] = await performanceImageDimensions.check(ctx);
    expect(r!.category).toBe('performance');
    expect(r!.severity).toBe('warning');
    expect(r!.route).toBe('/a');
    expect(r!.location).toBe('src/routes/+page.svelte');
    expect(r!.line).toBe(7);
    expect(r!.detection).toEqual({ presence: 'none', value: 'absent' });
  });

  it('passes an <img> with both dimensions (dynamic counts as present)', async () => {
    const ctx = ctxWith([{ route: '/a', images: [img({})] }]);
    const [r] = await performanceImageDimensions.check(ctx);
    expect(r!.detection).toEqual({ presence: 'own', value: 'static' }); // a seeding pass result
  });

  it('emits nothing for a route with no images (no Performance signal)', async () => {
    const ctx = ctxWith([{ route: '/empty', images: [] }]);
    const results = await performanceImageDimensions.check(ctx);
    expect(results).toHaveLength(0);
  });

  it('seeds a single passing result for an imaged route whose images all pass', async () => {
    const ctx = ctxWith([{ route: '/a', images: [img({})] }]);
    const results = await performanceImageDimensions.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0]!.detection.presence).toBe('own');
    // A passing seed has nothing to remediate, so it carries no fix.
    expect('fix' in results[0]!).toBe(false);
    // ResolvedImages has no route-level file (unlike ResolvedHead) — the route's first
    // image stands in as its attributed file (design 2026-08-08-pass-result-location-design.md;
    // imageRule's inline PASS literal was missed by the design spike's grep, added afterward).
    expect(results[0]!.location).toBe('src/routes/+page.svelte');
  });

  it('emits one finding per offending image', async () => {
    const ctx = ctxWith([{ route: '/a', images: [img({ hasWidth: false }), img({ hasHeight: false })] }]);
    const results = await performanceImageDimensions.check(ctx);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.detection.presence === 'none')).toBe(true);
  });
});

describe('performance/image-dimensions image line omission when unknown (line: 0)', () => {
  it('omits line property when img.line === 0', async () => {
    const imgNoLine = {
      hasWidth: false,
      hasHeight: true,
      hasLoading: true,
      hasAlt: true,
      lazy: false,
      hasSrcset: true,
      line: 0,
      file: 'src/routes/+page.svelte'
    };
    const ctx = ctxWith([{ route: '/a', images: [imgNoLine] }]);
    const [r] = await performanceImageDimensions.check(ctx);
    expect('line' in r!).toBe(false);
    expect(r!.line).toBeUndefined();
  });

  it('still sets line when img.line > 0', async () => {
    const ctx = ctxWith([{ route: '/a', images: [img({ hasWidth: false })] }]);
    const [r] = await performanceImageDimensions.check(ctx);
    expect(r!.line).toBe(7);
  });
});

describe('performance/image-loading-hint image loading', () => {
  it('flags a missing loading attribute as info', async () => {
    const ctx = ctxWith([{ route: '/a', images: [img({ hasLoading: false })] }]);
    const [r] = await performanceImageLoadingHint.check(ctx);
    expect(r!.severity).toBe('info');
    expect(r!.category).toBe('performance');
    expect(r!.detection.presence).toBe('none');
  });
});
