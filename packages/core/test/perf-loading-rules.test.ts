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
  it('a passing result carries no location (reverted in e67ed9a — see design doc "Out of scope")', async () => {
    const rs = await performancePreconnect.check(
      headsCtx(
        head('rendered', [
          link('preconnect', 'https://fonts.googleapis.com'),
          link('stylesheet', 'https://fonts.googleapis.com/css2?x')
        ])
      )
    );
    expect(rs[0]!.location).toBeUndefined();
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

  it('a layout-owned tag (tag.file differs from head.file) applies both severity and options from a files:-scoped override (Finding 1 containment)', async () => {
    // The tag carries its own `file` (as an inherited layout tag would), distinct from
    // head.file ('x' via the head() helper). Before the fix, options were resolved once
    // per head keyed on head.file, so a files: override scoped to the layout file would
    // rewrite severity (matched against the finding's tag-file location in the post-pass)
    // while never being consulted for options during the run — the origin would never be
    // added, so no finding would even be emitted.
    const layoutTag = { ...link('stylesheet', 'https://cdn.example.com/app.css'), file: 'src/routes/+layout.svelte' };
    const cfg = {
      overrides: [
        {
          files: 'src/routes/+layout.svelte',
          rules: {
            'performance/preconnect': { severity: 'warning' as const, options: { origins: ['cdn.example.com'] } }
          }
        }
      ]
    };
    const rs = await performancePreconnect.check(cfgHeadsCtx(head('rendered', [layoutTag]), cfg));
    // Options resolved during the run, keyed on the tag's own file: cdn.example.com is
    // only in scope because of the override targeting the layout file.
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.location).toBe('src/routes/+layout.svelte');
    expect(rs[0]!.message).toContain('cdn.example.com');
    // Severity resolved in the post-pass, matched by the same `files` glob against the
    // same tag-file location.
    const out = applyOverrides(rs, defineConfig(cfg));
    expect(out.find((r) => r.detection.value === 'absent')?.severity).toBe('warning');
  });

  it('counts a preconnect owned by a file the origins override does not match', async () => {
    // Options are resolved per tag, so two tags in one head can resolve different
    // `origins`. Coverage must not be gated on that: the preconnect lives in a shared
    // head component the `files:` glob does not match, while the reference it covers
    // lives in a route file the glob does match. Recording coverage inside the gate
    // reported the origin as un-preconnected even though the hint was right there.
    const reference = { ...link('stylesheet', 'https://cdn.example.com/app.css'), file: 'src/routes/+page.svelte' };
    const hint = { ...link('preconnect', 'https://cdn.example.com'), file: 'src/lib/Head.svelte' };
    const cfg = {
      overrides: [
        { files: 'src/routes/**', rules: { 'performance/preconnect': { options: { origins: ['cdn.example.com'] } } } }
      ]
    };
    const rs = await performancePreconnect.check(cfgHeadsCtx(head('rendered', [hint, reference]), cfg));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
    expect(rs[0]!.message).toBe('Third-party origins are preconnected');
  });

  it('still flags the origin when only the reference exists in that split-file shape', async () => {
    // The mirror of the case above: without the hint, the same config must still fail —
    // proving the test above passes because coverage was found, not because the origin
    // dropped out of scope.
    const reference = { ...link('stylesheet', 'https://cdn.example.com/app.css'), file: 'src/routes/+page.svelte' };
    const cfg = {
      overrides: [
        { files: 'src/routes/**', rules: { 'performance/preconnect': { options: { origins: ['cdn.example.com'] } } } }
      ]
    };
    const rs = await performancePreconnect.check(cfgHeadsCtx(head('rendered', [reference]), cfg));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('cdn.example.com');
  });

  it('does not treat a preconnect for an out-of-scope origin as a reference', async () => {
    // A preconnect is never itself a reference: a hint for an origin on no list at all
    // must stay invisible to the rule (no finding either way), not become a `referenced`
    // entry now that coverage is recorded before the origins gate.
    const rs = await performancePreconnect.check(
      headsCtx(head('rendered', [link('preconnect', 'https://other.example.com')]))
    );
    expect(rs).toHaveLength(0);
  });
});
