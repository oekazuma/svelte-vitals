import { describe, it, expect } from 'vitest';
import {
  seoIndexability,
  seoTwitterCard,
  seoOgDescription,
  seoOgUrl,
  seoViewport,
  seoSitemapInRobots
} from '../src/internal.js';
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
const fails = (rs: Awaited<ReturnType<typeof seoIndexability.check>>) =>
  rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');

describe('seo/indexability indexability', () => {
  it('flags a route whose robots meta is noindex', async () => {
    const rs = await seoIndexability.check(ctx(headWith([{ kind: 'meta', name: 'robots', noindex: true }])));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.severity).toBe('info');
  });
  it('does not flag when robots meta is not noindex', async () => {
    const rs = await seoIndexability.check(ctx(headWith([{ kind: 'meta', name: 'robots' }])));
    expect(rs).toHaveLength(0);
  });
});

describe('seo/twitter-card-014 head presence', () => {
  it('seo/twitter-card flags missing twitter:card, passes present', async () => {
    expect(fails(await seoTwitterCard.check(ctx(headWith([{ kind: 'meta', name: 'description' }]))))).toHaveLength(1);
    expect(fails(await seoTwitterCard.check(ctx(headWith([{ kind: 'meta', name: 'twitter:card' }]))))).toHaveLength(0);
  });
  it('seo/og-description matches og:description (info)', async () => {
    // info, not warning (2026-08-09 P2 severity-alignment review, #10): OGP lists
    // og:description as optional, so its severity is now below og:url's (required).
    expect(seoOgDescription.severity).toBe('info');
    expect(
      fails(await seoOgDescription.check(ctx(headWith([{ kind: 'meta', property: 'og:description' }]))))
    ).toHaveLength(0);
  });
  it('seo/og-url matches og:url (warning)', async () => {
    // warning, not info (same review, #10): OGP lists og:url as required.
    expect(seoOgUrl.severity).toBe('warning');
    expect(fails(await seoOgUrl.check(ctx(headWith([{ kind: 'meta', property: 'og:url' }]))))).toHaveLength(0);
  });
  it('seo/viewport matches viewport (warning)', async () => {
    expect(seoViewport.severity).toBe('warning');
    expect(fails(await seoViewport.check(ctx(headWith([{ kind: 'meta', name: 'viewport' }]))))).toHaveLength(0);
  });
  it('seo/viewport flags missing viewport in rendered mode', async () => {
    expect(fails(await seoViewport.check(ctx(headWith([{ kind: 'meta', name: 'description' }]))))).toHaveLength(1);
  });
  it('seo/viewport emits nothing in static (CLI) mode — viewport lives in app.html, unseen there', async () => {
    const rs = await seoViewport.check(ctx(headWith([{ kind: 'meta', name: 'description' }], 'static')));
    expect(rs).toHaveLength(0);
  });
});

describe('seo/sitemap-in-robots sitemap-in-robots', () => {
  const proj = (p: Partial<Project>): Project => ({ ...defaultProject, ...p });
  it('flags when robots+sitemap exist but robots does not reference the sitemap', async () => {
    const rs = await seoSitemapInRobots.check(
      ctx(headWith([]), proj({ hasRobotsTxt: true, hasSitemap: true, robotsReferencesSitemap: false }))
    );
    expect(fails(rs)).toHaveLength(1);
  });
  it('passes when robots references the sitemap', async () => {
    const rs = await seoSitemapInRobots.check(
      ctx(headWith([]), proj({ hasRobotsTxt: true, hasSitemap: true, robotsReferencesSitemap: true }))
    );
    expect(fails(rs)).toHaveLength(0);
  });
  it('emits nothing when robotsReferencesSitemap is undefined (endpoint/absent)', async () => {
    const rs = await seoSitemapInRobots.check(ctx(headWith([]), proj({ hasRobotsTxt: true, hasSitemap: true })));
    expect(rs).toHaveLength(0);
  });
});
