import { describe, it, expect } from 'vitest';
import {
  seo001Title,
  seo002Description,
  seo003Canonical,
  seo004OgImage,
  seo005OgTitle,
  seo006Robots,
  seo007Sitemap,
  seo008JsonLd,
  seo009HtmlLang,
  defaultProject,
  defaultConfig,
  type ResolvedHead
} from '../src/index.js';

const config = defaultConfig;
const emptyHead: ResolvedHead = { route: '/x', source: 'static', file: 'src/routes/x/+page.svelte', tags: [] };
const routeCtx = { heads: [emptyHead], project: defaultProject, config };
const projectCtx = { heads: [], project: defaultProject, config };

describe('rule fixes', () => {
  it('route-scope rules attach a fix with a description', async () => {
    for (const rule of [seo001Title, seo002Description, seo003Canonical, seo004OgImage, seo005OgTitle, seo008JsonLd]) {
      const [r] = await rule.check(routeCtx);
      expect(r!.fix, `${rule.id} fix`).toBeDefined();
      expect(typeof r!.fix!.description).toBe('string');
      expect(r!.fix!.description.length).toBeGreaterThan(0);
    }
  });

  it('project-scope rules attach a fix', async () => {
    for (const rule of [seo006Robots, seo007Sitemap, seo009HtmlLang]) {
      const [r] = await rule.check(projectCtx);
      expect(r!.fix, `${rule.id} fix`).toBeDefined();
      expect(r!.fix!.description.length).toBeGreaterThan(0);
    }
  });

  it('seo/description-presence fix snippet is a description meta tag', async () => {
    const [r] = await seo002Description.check(routeCtx);
    expect(r!.fix!.snippet).toContain('name="description"');
  });
});
