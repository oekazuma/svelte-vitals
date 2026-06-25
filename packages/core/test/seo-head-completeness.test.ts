import { describe, it, expect } from 'vitest';
import {
  seo010Indexability,
  seo011TwitterCard,
  seo012OgDescription,
  seo013OgUrl,
  seo014Viewport,
  seo015SitemapInRobots
} from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { HeadTag, ResolvedHead } from '../src/head.js';
import type { Project } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';

const headWith = (tags: Array<Partial<HeadTag>>, source: ResolvedHead['source'] = 'rendered'): ResolvedHead => ({
  route: '/x',
  source,
  file: 'x',
  tags: tags.map((t) => ({ presence: 'own', value: 'static', ...t }) as HeadTag)
});
const ctx = (head: ResolvedHead, project: Project = defaultProject): RuleContext => ({
  heads: [head],
  project,
  config: defineConfig({})
});
const fails = (rs: Awaited<ReturnType<typeof seo010Indexability.check>>) =>
  rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');

describe('SEO010 indexability', () => {
  it('flags a route whose robots meta is noindex', async () => {
    const rs = await seo010Indexability.check(ctx(headWith([{ kind: 'meta', name: 'robots', noindex: true }])));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.severity).toBe('info');
  });
  it('does not flag when robots meta is not noindex', async () => {
    const rs = await seo010Indexability.check(ctx(headWith([{ kind: 'meta', name: 'robots' }])));
    expect(rs).toHaveLength(0);
  });
});

describe('SEO011-014 head presence', () => {
  it('SEO011 flags missing twitter:card, passes present', async () => {
    expect(fails(await seo011TwitterCard.check(ctx(headWith([{ kind: 'meta', name: 'description' }]))))).toHaveLength(
      1
    );
    expect(fails(await seo011TwitterCard.check(ctx(headWith([{ kind: 'meta', name: 'twitter:card' }]))))).toHaveLength(
      0
    );
  });
  it('SEO012 matches og:description (warning)', async () => {
    expect(seo012OgDescription.severity).toBe('warning');
    expect(
      fails(await seo012OgDescription.check(ctx(headWith([{ kind: 'meta', property: 'og:description' }]))))
    ).toHaveLength(0);
  });
  it('SEO013 matches og:url', async () => {
    expect(fails(await seo013OgUrl.check(ctx(headWith([{ kind: 'meta', property: 'og:url' }]))))).toHaveLength(0);
  });
  it('SEO014 matches viewport (warning)', async () => {
    expect(seo014Viewport.severity).toBe('warning');
    expect(fails(await seo014Viewport.check(ctx(headWith([{ kind: 'meta', name: 'viewport' }]))))).toHaveLength(0);
  });
  it('SEO014 flags missing viewport in rendered mode', async () => {
    expect(fails(await seo014Viewport.check(ctx(headWith([{ kind: 'meta', name: 'description' }]))))).toHaveLength(1);
  });
  it('SEO014 emits nothing in static (CLI) mode — viewport lives in app.html, unseen there', async () => {
    const rs = await seo014Viewport.check(ctx(headWith([{ kind: 'meta', name: 'description' }], 'static')));
    expect(rs).toHaveLength(0);
  });
});

describe('SEO015 sitemap-in-robots', () => {
  const proj = (p: Partial<Project>): Project => ({ ...defaultProject, ...p });
  it('flags when robots+sitemap exist but robots does not reference the sitemap', async () => {
    const rs = await seo015SitemapInRobots.check(
      ctx(headWith([]), proj({ hasRobotsTxt: true, hasSitemap: true, robotsReferencesSitemap: false }))
    );
    expect(fails(rs)).toHaveLength(1);
  });
  it('passes when robots references the sitemap', async () => {
    const rs = await seo015SitemapInRobots.check(
      ctx(headWith([]), proj({ hasRobotsTxt: true, hasSitemap: true, robotsReferencesSitemap: true }))
    );
    expect(fails(rs)).toHaveLength(0);
  });
  it('emits nothing when robotsReferencesSitemap is undefined (endpoint/absent)', async () => {
    const rs = await seo015SitemapInRobots.check(ctx(headWith([]), proj({ hasRobotsTxt: true, hasSitemap: true })));
    expect(rs).toHaveLength(0);
  });
});
