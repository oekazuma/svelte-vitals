import { describe, it, expect } from 'vitest';
import {
  performanceLcpImage,
  performanceResponsiveImage,
  performanceRenderBlockingScript,
  performancePreconnect,
  applyOverrides
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

  it('a files:-scoped override applies both its severity and its options (Finding 1 parity)', async () => {
    // head() gives the head file 'x' (no tag-level file), matching a files: 'x' override.
    const cfg = {
      overrides: [
        {
          files: 'x',
          rules: {
            'performance/preconnect': { severity: 'warning' as const, options: { origins: ['cdn.example.com'] } }
          }
        }
      ]
    };
    const rs = await performancePreconnect.check(
      cfgHeadsCtx(head('rendered', [link('stylesheet', 'https://cdn.example.com/app.css')]), cfg)
    );
    expect(fails(rs)).toHaveLength(1);
    // Options resolved during the run: cdn.example.com is only checked because of the override.
    expect(rs[0]!.message).toContain('cdn.example.com');
    // Severity resolved in the post-pass, matched by the same `files` glob on the same location.
    const out = applyOverrides(rs, defineConfig(cfg));
    expect(out.find((r) => r.detection.value === 'absent')?.severity).toBe('warning');
  });

  it('a files:-scoped "off" override also removes a PASS seed its own options produced (Finding F, second review)', async () => {
    // head() gives the head file 'x' (no tag-level file), matching a files: 'x' override.
    // The origin is only third-party per the override's own `origins` option, and is
    // preconnected, so with the option applied this is a PASS.
    const cfg = {
      overrides: [
        {
          files: 'x',
          rules: {
            'performance/preconnect': { severity: 'off' as const, options: { origins: ['cdn.example.com'] } }
          }
        }
      ]
    };
    const rs = await performancePreconnect.check(
      cfgHeadsCtx(
        head('rendered', [
          link('preconnect', 'https://cdn.example.com'),
          link('stylesheet', 'https://cdn.example.com/app.css')
        ]),
        cfg
      )
    );
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
    // The passing seed must carry a `location` so the same `files: 'x'` override that
    // supplied its options can also match it in the post-pass and remove it via 'off'.
    const out = applyOverrides(rs, defineConfig(cfg));
    expect(out).toHaveLength(0);
  });
});
