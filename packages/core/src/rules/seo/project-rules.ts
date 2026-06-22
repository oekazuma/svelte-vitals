import type { Detection, Fix, Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

const present: Detection = { presence: 'own', value: 'static' };
const absent: Detection = { presence: 'none', value: 'absent' };

const SEO006_FIX: Fix = {
  description: 'Create static/robots.txt (or a src/routes/robots.txt/+server endpoint).',
  snippet: 'User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml',
  lang: 'text'
};

export const seo006Robots: Rule = {
  id: 'SEO006',
  title: 'robots.txt',
  category: 'seo',
  severity: 'warning',
  scope: 'project',
  rationale:
    'robots.txt tells crawlers which paths they may fetch and points them to your sitemap; missing it leaves crawl behaviour to defaults.',
  fix: SEO006_FIX,
  async check(ctx: RuleContext): Promise<Result[]> {
    const detection = ctx.project.hasRobotsTxt ? present : absent;
    return [
      {
        id: 'SEO006',
        category: 'seo',
        severity: 'warning',
        detection,
        message: ctx.project.hasRobotsTxt ? 'robots.txt' : 'Missing robots.txt',
        recommendation: 'Add static/robots.txt or a src/routes/robots.txt/+server endpoint.',
        docsUrl: docsUrlFor('SEO006'),
        fix: { ...SEO006_FIX }
      }
    ];
  }
};

const SEO007_FIX: Fix = {
  description: 'Create static/sitemap.xml (or a src/routes/sitemap.xml/+server endpoint).',
  snippet:
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://example.com/</loc></url>\n</urlset>',
  lang: 'xml'
};

export const seo007Sitemap: Rule = {
  id: 'SEO007',
  title: 'sitemap.xml',
  category: 'seo',
  severity: 'warning',
  scope: 'project',
  rationale:
    'A sitemap.xml lists your URLs so search engines can discover and prioritise them, especially pages not well linked internally.',
  fix: SEO007_FIX,
  async check(ctx: RuleContext): Promise<Result[]> {
    const detection = ctx.project.hasSitemap ? present : absent;
    return [
      {
        id: 'SEO007',
        category: 'seo',
        severity: 'warning',
        detection,
        message: ctx.project.hasSitemap ? 'sitemap.xml' : 'Missing sitemap.xml',
        recommendation: 'Add static/sitemap.xml or a src/routes/sitemap.xml/+server endpoint.',
        docsUrl: docsUrlFor('SEO007'),
        fix: { ...SEO007_FIX }
      }
    ];
  }
};

const SEO009_FIX: Fix = {
  description: 'Set the lang attribute on <html> in src/app.html.',
  snippet: '<html lang="en">',
  lang: 'html'
};

export const seo009HtmlLang: Rule = {
  id: 'SEO009',
  title: '<html lang>',
  category: 'seo',
  severity: 'warning',
  scope: 'project',
  rationale:
    'The <html lang> attribute declares the page language for search engines, screen readers, and translation tools.',
  fix: SEO009_FIX,
  async check(ctx: RuleContext): Promise<Result[]> {
    const detection = ctx.project.htmlLang;
    const message =
      detection.presence === 'none'
        ? 'Missing <html lang>'
        : detection.value === 'absent'
          ? 'Empty <html lang>'
          : '<html lang>';
    return [
      {
        id: 'SEO009',
        category: 'seo',
        severity: 'warning',
        detection,
        message,
        recommendation: 'Set <html lang="..."> in src/app.html.',
        docsUrl: docsUrlFor('SEO009'),
        fix: { ...SEO009_FIX }
      }
    ];
  }
};
