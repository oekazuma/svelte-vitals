import { describe, it, expect } from 'vitest';
import { defineConfig } from '../src/index.js';
import { seoRobotsTxt, seoSitemapXml, seoHtmlLang, defaultProject, type Project } from '../src/internal.js';

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
  it('each result carries its rule id and says which state it found', async () => {
    const doc = (id: string) => `https://oekazuma.github.io/svelte-vitals/rules/${id}`;
    const [noRobots] = await seoRobotsTxt.check(ctx(defaultProject));
    const [robots] = await seoRobotsTxt.check(ctx({ ...defaultProject, hasRobotsTxt: true }));
    expect(noRobots).toMatchObject({ id: 'seo/robots-txt', docsUrl: doc('seo/robots-txt') });
    expect(noRobots!.message).toContain('Missing');
    expect(robots!.message).not.toContain('Missing');

    const [noSitemap] = await seoSitemapXml.check(ctx(defaultProject));
    const [sitemap] = await seoSitemapXml.check(ctx({ ...defaultProject, hasSitemap: true }));
    expect(noSitemap).toMatchObject({
      id: 'seo/sitemap-xml',
      docsUrl: doc('seo/sitemap-xml'),
      detection: { presence: 'none', value: 'absent' }
    });
    expect(noSitemap!.message).toContain('Missing');
    expect(sitemap!.message).not.toContain('Missing');

    const lang = async (htmlLang: Project['htmlLang']) =>
      (await seoHtmlLang.check(ctx({ ...defaultProject, htmlLang })))[0]!;
    const missing = await lang({ presence: 'none', value: 'absent' });
    expect(missing).toMatchObject({ id: 'seo/html-lang', docsUrl: doc('seo/html-lang') });
    expect(missing.message).toContain('Missing');
    expect((await lang({ presence: 'own', value: 'absent' })).message).toContain('Empty');
    expect((await lang({ presence: 'own', value: 'static' })).message).not.toMatch(/Missing|Empty/);
  });
});
