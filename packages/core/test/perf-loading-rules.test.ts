import { describe, it, expect } from 'vitest';
import {
  performanceLcpImage,
  performanceResponsiveImage,
  performanceRenderBlockingScript,
  performancePreconnect
} from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { HeadTag, ResolvedHead } from '../src/head.js';
import type { ImageInfo, ResolvedImages } from '../src/images.js';
import type { RuleContext } from '../src/rule.js';

const config = defineConfig({});
const base = { project: defaultProject, config };
const fails = (rs: { detection: { presence: string; value: string } }[]) =>
  rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');

const img = (over: Partial<ImageInfo>): ImageInfo => ({
  hasWidth: true,
  hasHeight: true,
  hasLoading: true,
  hasAlt: true,
  lazy: false,
  hasSrcset: true,
  line: 3,
  file: 'src/routes/+page.svelte',
  ...over
});
const imagesCtx = (images: ResolvedImages[]): RuleContext => ({ heads: [], images, ...base });

describe('performance/lcp-image LCP image eager loading', () => {
  it('flags a lazy first image', async () => {
    const rs = await performanceLcpImage.check(imagesCtx([{ route: '/a', images: [img({ lazy: true })] }]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.line).toBe(3);
  });
  it('passes an eager first image', async () => {
    const rs = await performanceLcpImage.check(imagesCtx([{ route: '/a', images: [img({ lazy: false })] }]));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });
  it('only inspects the first image (a later lazy image is not flagged)', async () => {
    const rs = await performanceLcpImage.check(
      imagesCtx([{ route: '/a', images: [img({ lazy: false }), img({ lazy: true })] }])
    );
    expect(fails(rs)).toHaveLength(0);
  });
  it('emits nothing for a route with no images', async () => {
    expect(await performanceLcpImage.check(imagesCtx([{ route: '/a', images: [] }]))).toHaveLength(0);
  });
});

describe('performance/responsive-image responsive image', () => {
  it('flags an <img> without srcset (info)', async () => {
    const rs = await performanceResponsiveImage.check(
      imagesCtx([{ route: '/a', images: [img({ hasSrcset: false })] }])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.severity).toBe('info');
  });
  it('passes an <img> with srcset', async () => {
    const rs = await performanceResponsiveImage.check(imagesCtx([{ route: '/a', images: [img({ hasSrcset: true })] }]));
    expect(fails(rs)).toHaveLength(0);
  });
});

const head = (source: 'static' | 'rendered', tags: Partial<HeadTag>[]): ResolvedHead => ({
  route: '/x',
  source,
  file: 'x',
  tags: tags.map((t) => ({ presence: 'own', value: 'static', ...t }) as HeadTag)
});
const headsCtx = (h: ResolvedHead): RuleContext => ({ heads: [h], ...base });

describe('performance/render-blocking-script render-blocking script', () => {
  it('flags a blocking head script (rendered)', async () => {
    const rs = await performanceRenderBlockingScript.check(
      headsCtx(head('rendered', [{ kind: 'script', href: '/a.js', blocking: true }]))
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('/a.js');
  });
  it('passes a head with a non-blocking script', async () => {
    const rs = await performanceRenderBlockingScript.check(
      headsCtx(head('rendered', [{ kind: 'script', href: '/a.js' }]))
    );
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });
  it('also flags a blocking script in static mode (svelte:head)', async () => {
    const rs = await performanceRenderBlockingScript.check(
      headsCtx(head('static', [{ kind: 'script', href: '/a.js', blocking: true }]))
    );
    expect(fails(rs)).toHaveLength(1);
  });
  it('emits nothing for a head with no <script> at all', async () => {
    expect(await performanceRenderBlockingScript.check(headsCtx(head('rendered', [{ kind: 'title' }])))).toHaveLength(
      0
    );
  });
});

const link = (rel: string, href: string): Partial<HeadTag> => ({ kind: 'link', rel, href });

describe('performance/preconnect preconnect third-party origin', () => {
  it('flags a third-party stylesheet with no preconnect', async () => {
    const rs = await performancePreconnect.check(
      headsCtx(head('rendered', [link('stylesheet', 'https://fonts.googleapis.com/css2?x')]))
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('fonts.googleapis.com');
  });
  it('passes when the origin is preconnected', async () => {
    const rs = await performancePreconnect.check(
      headsCtx(
        head('rendered', [
          link('preconnect', 'https://fonts.googleapis.com'),
          link('stylesheet', 'https://fonts.googleapis.com/css2?x')
        ])
      )
    );
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });
  it('emits nothing when no third-party origin is referenced', async () => {
    const rs = await performancePreconnect.check(
      headsCtx(head('rendered', [link('canonical', 'https://example.com/')]))
    );
    expect(rs).toHaveLength(0);
  });

  const cfgHeadsCtx = (h: ResolvedHead, cfg: Parameters<typeof defineConfig>[0]): RuleContext => ({
    heads: [h],
    project: defaultProject,
    config: defineConfig(cfg)
  });
  const extra = { rules: { 'performance/preconnect': { options: { origins: ['cdn.example.com'] } } } };

  it('flags an origin added through config', async () => {
    const rs = await performancePreconnect.check(
      cfgHeadsCtx(head('rendered', [link('stylesheet', 'https://cdn.example.com/app.css')]), extra)
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('cdn.example.com');
  });
  it('keeps the built-in origins when config adds one', async () => {
    const rs = await performancePreconnect.check(
      cfgHeadsCtx(head('rendered', [link('stylesheet', 'https://fonts.googleapis.com/css2?x')]), extra)
    );
    expect(fails(rs)).toHaveLength(1);
  });
  it('emits nothing for an origin on neither list', async () => {
    const rs = await performancePreconnect.check(
      cfgHeadsCtx(head('rendered', [link('stylesheet', 'https://other.example.com/app.css')]), extra)
    );
    expect(rs).toHaveLength(0);
  });
});
