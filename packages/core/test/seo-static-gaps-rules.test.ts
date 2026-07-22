import { describe, it, expect } from 'vitest';
import { seoCharset, seoImageAlt, seoHreflang, seoSingleH1 } from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { HeadTag, ResolvedHead } from '../src/head.js';
import type { ImageInfo, ResolvedImages } from '../src/images.js';
import type { ResolvedHeadings } from '../src/headings.js';
import type { RuleContext } from '../src/rule.js';

const config = defineConfig({});
const base = { project: defaultProject, config };
const fails = (rs: { detection: { presence: string; value: string } }[]) =>
  rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');

const head = (source: 'static' | 'rendered', tags: Partial<HeadTag>[]): ResolvedHead => ({
  route: '/x',
  source,
  file: 'x',
  tags: tags.map((t) => ({ presence: 'own', value: 'static', ...t }) as HeadTag)
});
const headsCtx = (h: ResolvedHead): RuleContext => ({ heads: [h], ...base });

describe('seo/charset charset', () => {
  it('passes a rendered page with <meta charset>', async () => {
    const rs = await seoCharset.check(headsCtx(head('rendered', [{ kind: 'meta', name: 'charset' }])));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });
  it('flags a rendered page without <meta charset>', async () => {
    const rs = await seoCharset.check(headsCtx(head('rendered', [{ kind: 'title' }])));
    expect(fails(rs)).toHaveLength(1);
  });
  it('emits nothing in static mode (charset lives in app.html)', async () => {
    expect(await seoCharset.check(headsCtx(head('static', [{ kind: 'title' }])))).toHaveLength(0);
  });
});

const img = (over: Partial<ImageInfo>): ImageInfo => ({
  hasWidth: true,
  hasHeight: true,
  hasLoading: true,
  hasAlt: true,
  lazy: false,
  hasSrcset: true,
  line: 1,
  file: 'x',
  ...over
});
const imagesCtx = (images: ResolvedImages[]): RuleContext => ({ heads: [], images, ...base });

describe('seo/image-alt image alt', () => {
  it('passes an <img> with an alt attribute (incl. empty alt="")', async () => {
    const rs = await seoImageAlt.check(imagesCtx([{ route: '/a', images: [img({ hasAlt: true })] }]));
    expect(rs[0]!.category).toBe('seo');
    expect(fails(rs)).toHaveLength(0);
  });
  it('flags an <img> with no alt attribute', async () => {
    const rs = await seoImageAlt.check(imagesCtx([{ route: '/a', images: [img({ hasAlt: false })] }]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.category).toBe('seo');
  });
  it('emits nothing in rendered mode (no images collected)', async () => {
    expect(await seoImageAlt.check({ heads: [], ...base })).toHaveLength(0);
  });
});

const alt = (hreflang?: string): Partial<HeadTag> => ({
  kind: 'link',
  rel: 'alternate',
  ...(hreflang !== undefined ? { hreflang } : {})
});

describe('seo/hreflang hreflang', () => {
  it('emits nothing when there are no hreflang alternates', async () => {
    const rs = await seoHreflang.check(headsCtx(head('rendered', [{ kind: 'link', rel: 'canonical' }])));
    expect(rs).toHaveLength(0);
  });
  it('passes a valid set with an x-default', async () => {
    const rs = await seoHreflang.check(headsCtx(head('rendered', [alt('en'), alt('en-US'), alt('x-default')])));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });
  it('flags a malformed hreflang value', async () => {
    const rs = await seoHreflang.check(headsCtx(head('rendered', [alt('english'), alt('x-default')])));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('english');
  });
  it('accepts BCP-47 script and UN M49 numeric-region codes', async () => {
    const rs = await seoHreflang.check(
      headsCtx(head('rendered', [alt('zh-Hant-TW'), alt('es-419'), alt('x-default')]))
    );
    expect(fails(rs)).toHaveLength(0);
  });
  it('flags an empty hreflang="" as invalid', async () => {
    const rs = await seoHreflang.check(headsCtx(head('rendered', [alt(''), alt('x-default')])));
    expect(fails(rs)).toHaveLength(1);
  });
  it('treats x-default case-insensitively', async () => {
    const rs = await seoHreflang.check(headsCtx(head('rendered', [alt('en'), alt('de'), alt('X-default')])));
    expect(fails(rs)).toHaveLength(0);
  });
  it('flags two or more alternates without an x-default', async () => {
    const rs = await seoHreflang.check(headsCtx(head('rendered', [alt('en'), alt('de')])));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('x-default');
  });
  it('passes a single self-referential alternate without x-default', async () => {
    const rs = await seoHreflang.check(headsCtx(head('rendered', [alt('en')])));
    expect(fails(rs)).toHaveLength(0);
  });
});

const headingsCtx = (headings: ResolvedHeadings[]): RuleContext => ({ heads: [], headings, ...base });
const hs = (levels: number[]): ResolvedHeadings => ({
  route: '/a',
  headings: levels.map((level) => ({ level, line: 0, file: 'x' }))
});

describe('seo/single-h1 heading hierarchy', () => {
  it('passes a page with exactly one <h1>', async () => {
    const rs = await seoSingleH1.check(headingsCtx([hs([1, 2, 2])]));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });
  it('flags a page with no <h1>', async () => {
    const rs = await seoSingleH1.check(headingsCtx([hs([2, 3])]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('Missing');
  });
  it('flags a page with multiple <h1>', async () => {
    const rs = await seoSingleH1.check(headingsCtx([hs([1, 1])]));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('Multiple');
  });
  it('emits nothing when the headings channel is unset', async () => {
    expect(await seoSingleH1.check({ heads: [], ...base })).toHaveLength(0);
  });
});
