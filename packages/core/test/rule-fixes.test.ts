import { describe, it, expect } from 'vitest';
import {
  seoTitlePresence,
  seoDescriptionPresence,
  seoCanonicalUrl,
  seoOgImage,
  seoOgTitle,
  seoRobotsTxt,
  seoSitemapXml,
  seoJsonLd,
  seoHtmlLang,
  defaultProject,
  defaultConfig,
  type ResolvedHead
} from '../src/internal.js';

const config = defaultConfig;
const emptyHead: ResolvedHead = { route: '/x', source: 'static', file: 'src/routes/x/+page.svelte', tags: [] };
const routeCtx = { heads: [emptyHead], project: defaultProject, config };
const projectCtx = { heads: [], project: defaultProject, config };

describe('rule fixes', () => {
  it('route-scope rules attach a fix with a description', async () => {
    for (const rule of [seoTitlePresence, seoDescriptionPresence, seoCanonicalUrl, seoOgImage, seoOgTitle, seoJsonLd]) {
      const [r] = await rule.check(routeCtx);
      expect(r!.fix, `${rule.id} fix`).toBeDefined();
      expect(typeof r!.fix!.description).toBe('string');
      expect(r!.fix!.description.length).toBeGreaterThan(0);
    }
  });

  it('project-scope rules attach a fix', async () => {
    for (const rule of [seoRobotsTxt, seoSitemapXml, seoHtmlLang]) {
      const [r] = await rule.check(projectCtx);
      expect(r!.fix, `${rule.id} fix`).toBeDefined();
      expect(r!.fix!.description.length).toBeGreaterThan(0);
    }
  });

  it('seo/description-presence fix snippet is a description meta tag', async () => {
    const [r] = await seoDescriptionPresence.check(routeCtx);
    expect(r!.fix!.snippet).toContain('name="description"');
  });
});
