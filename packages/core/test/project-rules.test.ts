import { describe, it, expect } from 'vitest';
import {
  seo006Robots,
  seo007Sitemap,
  seo009HtmlLang,
  defaultProject,
  defineConfig,
  type Project
} from '../src/index.js';

const config = defineConfig({});
const ctx = (project: Project) => ({ heads: [], project, config });

describe('project-scope rules', () => {
  it('SEO006 fails when robots.txt is absent, passes when present', async () => {
    const [absent] = await seo006Robots.check(ctx(defaultProject));
    expect(absent!.detection).toEqual({ presence: 'none', value: 'absent' });
    expect(absent!.route).toBeUndefined();
    const [present] = await seo006Robots.check(ctx({ ...defaultProject, hasRobotsTxt: true }));
    expect(present!.detection).toEqual({ presence: 'own', value: 'static' });
  });
  it('SEO007 reflects sitemap presence', async () => {
    const [present] = await seo007Sitemap.check(ctx({ ...defaultProject, hasSitemap: true }));
    expect(present!.detection.presence).toBe('own');
  });
  it('SEO009 reflects html lang detection', async () => {
    const [absent] = await seo009HtmlLang.check(ctx(defaultProject));
    expect(absent!.detection).toEqual({ presence: 'none', value: 'absent' });
    const [present] = await seo009HtmlLang.check(
      ctx({ ...defaultProject, htmlLang: { presence: 'own', value: 'static' } })
    );
    expect(present!.detection).toEqual({ presence: 'own', value: 'static' });
  });
});
