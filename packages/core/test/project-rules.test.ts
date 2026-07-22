import { describe, it, expect } from 'vitest';
import { seoRobotsTxt, seoSitemapXml, seoHtmlLang, defaultProject, defineConfig, type Project } from '../src/index.js';

const config = defineConfig({});
const ctx = (project: Project) => ({ heads: [], project, config });

describe('project-scope rules', () => {
  it('seo/robots-txt fails when robots.txt is absent, passes when present', async () => {
    const [absent] = await seoRobotsTxt.check(ctx(defaultProject));
    expect(absent!.detection).toEqual({ presence: 'none', value: 'absent' });
    expect(absent!.route).toBeUndefined();
    const [present] = await seoRobotsTxt.check(ctx({ ...defaultProject, hasRobotsTxt: true }));
    expect(present!.detection).toEqual({ presence: 'own', value: 'static' });
  });
  it('seo/sitemap-xml reflects sitemap presence', async () => {
    const [present] = await seoSitemapXml.check(ctx({ ...defaultProject, hasSitemap: true }));
    expect(present!.detection.presence).toBe('own');
  });
  it('seo/html-lang reflects html lang detection', async () => {
    const [absent] = await seoHtmlLang.check(ctx(defaultProject));
    expect(absent!.detection).toEqual({ presence: 'none', value: 'absent' });
    const [present] = await seoHtmlLang.check(
      ctx({ ...defaultProject, htmlLang: { presence: 'own', value: 'static' } })
    );
    expect(present!.detection).toEqual({ presence: 'own', value: 'static' });
  });
});
